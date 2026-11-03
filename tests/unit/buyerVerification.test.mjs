import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {verifyBuyerChallenge,buyerVerificationContext} from '../../supabase/functions/_shared/buyerVerification.js'
import {getBuyerVerification,saveBuyerVerification,buyerVerificationAttempt,pendingBuyerVerification,clearBuyerVerificationAttempt,listenForBuyerVerification,announceBuyerVerification,buyerVerificationCanReload} from '../../src/lib/buyerVerification.js'
const id='10000000-0000-4000-8000-000000000001',now=Date.now(),context={origin:'https://driveshaftcable.com',secret:'fixture-secret',test:false}
test('challenge validation requires the expected hostname/action/request ID, timestamp and server response; all failures close',async()=>{
 const good={success:true,hostname:'driveshaftcable.com',action:'buyer-checkout-verification',cdata:id,challenge_ts:new Date(now).toISOString()}
 const verify=result=>verifyBuyerChallenge('fixture-token',id,context,{now:()=>now,transport:async(url,options)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(JSON.parse(options.body).idempotency_key,id);assert.equal(JSON.parse(options.body).remoteip,undefined);return Response.json(result)}})
 assert.equal(await verify(good),true)
 for(const patch of [{success:false},{hostname:'evil.invalid'},{action:'other-form'},{cdata:'other-id'},{challenge_ts:'bad'},{challenge_ts:new Date(now-300001).toISOString()},{challenge_ts:new Date(now+30001).toISOString()}])assert.equal(await verify({...good,...patch}),false)
 assert.equal(await verifyBuyerChallenge('x'.repeat(2049),id,context,{transport:()=>assert.fail('oversized token must not reach provider')}),false)
 assert.equal(await verifyBuyerChallenge('fixture',id,context,{transport:async()=>{throw Error('offline')}}),false)
})
test('vendor dummy keys and relaxed dummy response work only on the exact approved synthetic project/host',async()=>{
 const dummy='1x0000000000000000000000000000000AA'
 const values={SUPABASE_URL:'https://dmpvmztdkfdkilygxiaj.supabase.co',REFERRAL_INVITE_STAGING_PROJECT_REF:'dmpvmztdkfdkilygxiaj',REFERRAL_INVITE_ORIGIN:'https://dsc-referral-stage-20261103.onrender.com',BUYER_VERIFICATION_CHALLENGE_SECRET:dummy,BUYER_VERIFICATION_TEST_MODE:'true'}
 const get=map=>({get:key=>map[key]})
 const ctx=buyerVerificationContext(get(values));assert.equal(ctx.test,true)
 assert.equal(await verifyBuyerChallenge('XXXX.DUMMY.TOKEN.XXXX',id,ctx,{transport:async()=>Response.json({success:true,hostname:'localhost',action:'test'})}),true)
 assert.equal(await verifyBuyerChallenge('XXXX.DUMMY.TOKEN.XXXX',id,ctx,{transport:async()=>Response.json({success:true,hostname:'example.com',metadata:{result_with_testing_key:true}})}),true)
 for(const patch of [{metadata:{}},{metadata:{result_with_testing_key:false}},{hostname:'evil.invalid'},{action:'other'},{cdata:'unexpected'}])assert.equal(await verifyBuyerChallenge('XXXX.DUMMY.TOKEN.XXXX',id,ctx,{transport:async()=>Response.json({success:true,hostname:'example.com',metadata:{result_with_testing_key:true},...patch})}),false)
 assert.equal(await verifyBuyerChallenge('XXXX.DUMMY.TOKEN.XXXX',id,ctx,{transport:async()=>Response.json({success:true,hostname:'evil.invalid',action:'test'})}),false)
 assert.throws(()=>buyerVerificationContext(get({SUPABASE_URL:'https://twrihhyfvomqiqbxkitc.supabase.co',BUYER_VERIFICATION_CHALLENGE_SECRET:dummy})),/Test challenge keys/)
 assert.throws(()=>buyerVerificationContext(get({...values,SUPABASE_URL:'https://twrihhyfvomqiqbxkitc.supabase.co'})))
 assert.throws(()=>buyerVerificationContext(get({...values,BUYER_VERIFICATION_CHALLENGE_SECRET:'fixture-real-key'})),/not configured/)
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
