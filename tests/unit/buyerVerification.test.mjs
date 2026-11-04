import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {verifyBuyerChallenge,buyerVerificationContext} from '../../supabase/functions/_shared/buyerVerification.js'
import {getBuyerVerification,saveBuyerVerification,buyerVerificationAttempt,pendingBuyerVerification,clearBuyerVerificationAttempt,listenForBuyerVerification,announceBuyerVerification,buyerVerificationCanReload} from '../../src/lib/buyerVerification.js'
import {solvedBuyerChallenge,fixtureContext,fixtureSigningKey} from '../fixtures/buyerProofOfWork.mjs'
import {issueBuyerProofOfWork} from '../../supabase/functions/_shared/buyerProofOfWork.js'
const id='10000000-0000-4000-8000-000000000001',now=Date.now(),email='buyer+tag@invalid.test'
test('self-hosted challenge is signed, email/request/project/origin bound, bounded and expiring; mutations fail closed',async()=>{
 const payload=await solvedBuyerChallenge(email,id),value=JSON.parse(atob(payload)),verify=p=>verifyBuyerChallenge(p,email,id,fixtureContext)
 const hash=await verify(payload);assert.match(hash,/^[a-f0-9]{64}$/)
 assert.equal(await verifyBuyerChallenge(payload,'other@invalid.test',id,fixtureContext),null)
 assert.equal(await verifyBuyerChallenge(payload,email,crypto.randomUUID(),fixtureContext),null)
 assert.equal(await verifyBuyerChallenge(payload,email,id,{...fixtureContext,origin:'https://other.invalid'}),null)
 assert.equal(await verifyBuyerChallenge(payload,email,id,{...fixtureContext,project:'https://other.invalid'}),null)
 assert.equal(await verifyBuyerChallenge(payload,email,id,{...fixtureContext,keyMaterial:fixtureSigningKey+'other'}),null)
 for(const patch of [{cost:1},{cost:500000000},{algorithm:'SHA-256'},{keyPrefix:''},{expiresAt:Math.floor(Date.now()/1000)+3600},{nonce:'invalid'},{salt:'invalid'},{keySignature:'f'.repeat(64)}]){
  const changed=structuredClone(value);Object.assign(changed.challenge.parameters,patch);assert.equal(await verify(btoa(JSON.stringify(changed))),null)
 }
 for(const patch of [{counter:-1},{counter:4294967296},{counter:0.5},{derivedKey:'0'.repeat(64)}]){
  const changed=structuredClone(value);Object.assign(changed.solution,patch);assert.equal(await verify(btoa(JSON.stringify(changed))),null)
 }
 const changed=structuredClone(value);changed.solution.time=12345
 assert.equal(await verify(btoa(JSON.stringify(changed))),hash,'solution metadata cannot change the replay identity')
 const reordered={solution:value.solution,challenge:{signature:value.challenge.signature,parameters:value.challenge.parameters}}
 assert.equal(await verify(btoa(JSON.stringify(reordered))),hash,'JSON reordering cannot evade single-use SQL identity')
 for(const bad of ['x'.repeat(3073),'not-base64','XXXX.DUMMY.TOKEN.XXXX',btoa(JSON.stringify({challenge:null,solution:null,test:true}))])assert.equal(await verify(bad),null)
 assert.equal(await verifyBuyerChallenge(payload,email,id,fixtureContext,{now:()=>Date.now()+301000}),null)
 const challenge=await issueBuyerProofOfWork(email,id,fixtureContext)
 assert.ok(!JSON.stringify(challenge).includes(email));assert.ok(!JSON.stringify(challenge).includes(fixtureSigningKey))
})
test('unknown project, missing backend key and every mock/test bypass fail closed',()=>{
 const get=values=>({get:key=>values[key]}),live={SUPABASE_URL:fixtureContext.project,STORE_SUPABASE_SECRET_KEY:fixtureSigningKey}
 assert.equal(buyerVerificationContext(get(live)).stage,false)
 assert.throws(()=>buyerVerificationContext(get({...live,SUPABASE_URL:'https://unknown.supabase.co'})),/not configured|not approved/)
 assert.throws(()=>buyerVerificationContext(get({...live,STORE_SUPABASE_SECRET_KEY:''})),/not configured/)
 assert.throws(()=>buyerVerificationContext(get({...live,BUYER_VERIFICATION_TEST_MODE:'true'})),/Mock challenge/)
 assert.throws(()=>buyerVerificationContext(get({...live,BUYER_VERIFICATION_APPROVED_TEST_RECIPIENT:'owner@invalid.test'})),/Test recipient/)
})
function browser(group=new Map()){
 const stored=new Map()
 class Channel{constructor(name){this.name=name;this.peers=group.get(name)||new Set();this.peers.add(this);group.set(name,this.peers)}postMessage(data){for(const peer of this.peers)if(peer!==this)peer.onmessage?.({data})}close(){this.peers.delete(this)}}
 return {sessionStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},crypto,BroadcastChannel:Channel,stored}
}
test('receiver proof reaches matching tabs in its browser only, never a different browser requester',()=>{
 const same=new Map(),original=browser(same),receiver=browser(same),attacker=browser();let owned=null,stolen=null
 const stop=listenForBuyerVerification(' Buyer+tag@invalid.test ',value=>owned=value,original),stopAttacker=listenForBuyerVerification('buyer+tag@invalid.test',value=>stolen=value,attacker)
 const proof=saveBuyerVerification({email:'BUYER+tag@invalid.test',token:'a'.repeat(64),expiresAt:now+300000},receiver,now)
 announceBuyerVerification(proof,receiver)
 assert.equal(owned.token,proof.token);assert.equal(stolen,null);assert.equal(getBuyerVerification('buyer+tag@invalid.test',attacker,now),null)
 assert.equal(getBuyerVerification('buyer@invalid.test',original,now),null,'plus tag remains distinct')
 assert.equal(saveBuyerVerification({...proof,expiresAt:now+7200000},receiver,now),null,'unbounded client expiry is rejected')
 stop();stopAttacker()
})
test('explicit confirmation attempt keeps one receiver proof for lost-response retry, including session reload and memory-only fallback',()=>{
 const b=browser(),token='b'.repeat(64),first=buyerVerificationAttempt(token,b,now)
 assert.notEqual(first.proofToken,token);delete b.__buyerEmailConfirmation
 assert.equal(buyerVerificationAttempt(token,b,now+1000).proofToken,first.proofToken)
 assert.equal(pendingBuyerVerification(b,now+3600001),null)
 clearBuyerVerificationAttempt(b);assert.equal(pendingBuyerVerification(b,now),null)
 const memory={crypto,sessionStorage:{getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}}}
 const p=buyerVerificationAttempt(token,memory,now);assert.equal(buyerVerificationAttempt(token,memory,now).proofToken,p.proofToken)
 assert.equal(buyerVerificationCanReload(b,now),false)
 const proof={email:'receiver@invalid.test',token:'c'.repeat(64),expiresAt:now+300000}
 saveBuyerVerification(proof,b,now);assert.equal(buyerVerificationCanReload(b,now),true)
 delete b.__buyerEmailProof;assert.equal(buyerVerificationCanReload(b,now),true,'persisted proof survives a same-tab document navigation')
 saveBuyerVerification(proof,memory,now);assert.equal(buyerVerificationCanReload(memory,now),false,'blocked storage must retain SPA memory fallback')
 assert.equal(getBuyerVerification(proof.email,memory,now).token,proof.token)
 assert.equal(buyerVerificationCanReload(b,now+300001),false)
})
test('email token is scrubbed synchronously before analytics; unrelated route anchors stay intact',()=>{
 const index=readFileSync('index.html','utf8');assert.ok(index.indexOf('/buyer-email-verification.js')<index.indexOf('googletagmanager'))
 const source=readFileSync('public/buyer-email-verification.js','utf8'),document={createElement:()=>({}),head:{appendChild(){}}}
 const window={location:{pathname:'/checkout/verify-email',hash:'#private-fixture'},history:{replaceState(...args){this.args=args}}}
 runInNewContext(source,{window,document});assert.equal(window.__buyerEmailVerificationToken,'private-fixture');assert.equal(window.history.args[2],'/checkout/verify-email')
 const other={location:{pathname:'/products/cable',hash:'#details'},history:{replaceState(){assert.fail('ordinary anchors must not change')}}};runInNewContext(source,{window:other,document});assert.equal(other.__buyerEmailVerificationToken,undefined)
})
test('private utility path blocks analytics independently when the external scrubber fails to load',()=>{
 const html=readFileSync('index.html','utf8'),source=html.match(/<!-- Google Analytics -->\s*<script>([\s\S]*?)<\/script>/)[1]
 for(const pathname of ['/checkout/verify-email','/referral/signup']){
  const appended=[],window={location:{pathname,hash:'#private-fixture'}}
  runInNewContext(source,{window,document:{createElement:()=>({}),head:{appendChild:value=>appended.push(value)}},Date})
  assert.equal(appended.length,0);assert.equal(window.gtag,undefined)
 }
 const appended=[],window={location:{pathname:'/products/driveshaft-cable'}}
 runInNewContext(source,{window,document:{createElement:()=>({}),head:{appendChild:value=>appended.push(value)}},Date})
 assert.equal(appended.length,1);assert.match(appended[0].src,/googletagmanager/);assert.equal(window.dataLayer.length,2)
})
