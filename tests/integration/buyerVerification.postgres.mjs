import {test} from 'node:test'
import assert from 'node:assert/strict'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {createSecurePayment,normalizeCheckoutInput,resumeSecurePayment,checkoutDigest,reconcileOrderPayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {requestBuyerVerification,consumeBuyerVerification,verifyBuyerChallenge,buyerVerificationContext} from '../../supabase/functions/_shared/buyerVerification.js'
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
const env={get:name=>({BUYER_EMAIL_VERIFICATION_ENABLED:'true',BUYER_VERIFICATION_EMAILS_ENABLED:'true',RESEND_API_KEY:'fixture-mail-key',SUPABASE_URL:'https://twrihhyfvomqiqbxkitc.supabase.co',BUYER_VERIFICATION_CHALLENGE_SECRET:'fixture-real-shape-secret'}[name])}
async function setup(){
 const f=await commerceFixture({policyRuntime:true,emailVerification:true})
 await f.sql.exec('reset role');await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented)values('owner@invalid.test','Owner','paid','confirmed','cash','[]',100,true)");await f.sql.exec('set role service_role;update referral_settings set enabled=true,buyer_verification_emails_enabled=true')
 const p=await f.db.rpc('referral_create_partner',{p_actor:f.owner,p_email:'owner@invalid.test',p_name:'Owner',p_code:'VERIFY-CODE',p_generate:false});assert.ifError(p.error);await f.sql.query("update referral_partners set status='active' where id=$1",[p.data.id]);return f
}
const request=(email='buyer@invalid.test',code='VERIFY-CODE')=>({checkoutId:crypto.randomUUID(),checkoutToken:token(),customer:{email,name:'Buyer',address1:'123 Fixture Lane',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}],referralCode:code})
const priced=async(f,input)=>({...input,amount:(await f.price(normalizeCheckoutInput(input))).totalCents})
const create=(f,input)=>createSecurePayment(f.db,f.stripe,input,f.price,{referralEnabled:true})
async function link(f,email){const secret=token(),id=crypto.randomUUID();const r=await f.db.rpc('buyer_verification_prepare',{p_id:id,p_email:email,p_link_hash:await checkoutDigest(secret),p_challenge_hash:await checkoutDigest(token())});assert.ifError(r.error);assert.equal(r.data,true);return {secret,id}}
async function proof(f,email){const l=await link(f,email),secret=token();const consumed=await consumeBuyerVerification(f.db,{token:l.secret,proofToken:secret},env);assert.equal(consumed.status,200);return {...l,proof:secret,result:consumed.body}}
test('both coded and uncoded first reservations require this caller’s live proof, while a victim’s later confirmation grants the requester nothing',async()=>{
 const f=await setup();try{
  const input=await priced(f,request()),quote=await f.price(normalizeCheckoutInput(input));assert.equal(quote.verificationRequired,true)
  await assert.rejects(()=>create(f,input),/Email verification required/)
  const receiver=await proof(f,'buyer@invalid.test')
  await assert.rejects(()=>create(f,input),/Email verification required/,'proof existence is not proof possession')
  await assert.rejects(()=>create(f,{...input,buyerVerificationToken:token()}),/Email verification required/)
  const different=await priced(f,request('other@invalid.test',null));await assert.rejects(()=>create(f,{...different,buyerVerificationToken:receiver.proof}),/Email verification required/)
  const made=await create(f,{...input,buyerVerificationToken:receiver.proof});assert.equal(made.status,200)
  assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,1)
  for(const secret of [receiver.secret,receiver.proof]){
   assert.ok(!JSON.stringify(made.body).includes(secret));assert.ok(!JSON.stringify(f.payments).includes(secret));assert.ok(!JSON.stringify(f.calls).includes(secret))
  }
 }finally{await f.sql.close()}
})
test('link consumption is explicit, same-pair retry is idempotent, different proofs and expired links cannot renew ownership',async()=>{
 const f=await setup();try{
  const l=await link(f,'receiver@invalid.test'),p=token()
  assert.equal((await f.sql.query('select count(*)::int n from buyer_verification_proofs')).rows[0].n,0,'issuing an email never grants ownership')
  const first=await consumeBuyerVerification(f.db,{token:l.secret,proofToken:p},env),retry=await consumeBuyerVerification(f.db,{token:l.secret,proofToken:p},env)
  assert.deepEqual(retry.body,first.body);assert.equal(first.body.proofToken,undefined)
  await assert.rejects(()=>consumeBuyerVerification(f.db,{token:l.secret,proofToken:token()},env),/unavailable/)
  await f.sql.exec("update buyer_verification_proofs set expires_at=now()-interval '1 second'")
  await assert.rejects(()=>consumeBuyerVerification(f.db,{token:l.secret,proofToken:p},env),/unavailable/)
  const old=await link(f,'expired@invalid.test');await f.sql.query("update buyer_verification_requests set expires_at=now()-interval '1 second' where id=$1",[old.id])
  await assert.rejects(()=>consumeBuyerVerification(f.db,{token:old.secret,proofToken:token()},env),/unavailable/)
 }finally{await f.sql.close()}
})
test('a prepared capability survives proof expiry, but expired proof cannot authorize a new first reservation',async()=>{
 const f=await setup();try{
  const input=await priced(f,request()),p=await proof(f,input.customer.email),first=await create(f,{...input,buyerVerificationToken:p.proof})
  await f.sql.exec("update buyer_verification_proofs set expires_at=now()-interval '1 second'")
  assert.equal((await create(f,input)).body.clientSecret,first.body.clientSecret)
  assert.equal((await resumeSecurePayment(f.db,f.stripe,input)).body.clientSecret,first.body.clientSecret)
  const another=await priced(f,request('expired-buyer@invalid.test',null)),otherProof=await proof(f,another.customer.email)
  await f.sql.exec("update buyer_verification_proofs set expires_at=now()-interval '1 second'")
  await assert.rejects(()=>create(f,{...another,buyerVerificationToken:otherProof.proof}),/Email verification required/)
  assert.equal(f.intents.size,1)
 }finally{await f.sql.close()}
})
test('repeat paid/refunded history uses the same eligibility predicate, not whether another proof exists',async()=>{
 const f=await setup();try{
  for(const state of ['paid','refunded','partially_refunded']){
   const email=state+'@invalid.test';await f.sql.exec('reset role');await f.sql.query("insert into orders(email,payment_status,status,payment_method,items,total_cents)values($1,$2,'confirmed','stripe','[]',100)",[email,state]);await f.sql.exec('set role service_role')
   const input=await priced(f,request(email,null));assert.equal((await f.price(normalizeCheckoutInput(input))).verificationRequired,false);assert.equal((await create(f,input)).status,200)
  }
 }finally{await f.sql.close()}
})
test('requester receives no link/proof, delivery is deduped, resends do not invalidate links and uncertain sends are not retried blindly',async()=>{
 const f=await setup();try{
  const email='mail@invalid.test',id=crypto.randomUUID(),secret=token(),sends=[]
  const input={email,requestId:id,challenge:'fixture-challenge-'+id}
  const challengeTransport=async()=>Response.json({success:true,hostname:'driveshaftcable.com',action:'buyer-checkout-verification',cdata:id,challenge_ts:new Date().toISOString()})
  const emailTransport=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sends.push(JSON.parse(options.body));return Response.json({id:'fixture-accepted'})}
  const options={challengeTransport,emailTransport,randomToken:()=>secret}
  const response=await requestBuyerVerification(f.db,input,env,options)
  assert.equal(response.status,202);assert.ok(!JSON.stringify(response).includes(secret));assert.equal(response.body.email,undefined);assert.equal(response.body.requestId,undefined)
  assert.equal(sends[0].to,email);assert.match(sends[0].text,/https:\/\/driveshaftcable.com\/checkout\/verify-email#[a-f0-9]{64}/)
  await requestBuyerVerification(f.db,input,env,options);assert.equal(sends.length,1)
  const sameEmail=await f.db.rpc('buyer_verification_prepare',{p_id:crypto.randomUUID(),p_email:email,p_link_hash:await checkoutDigest(token()),p_challenge_hash:await checkoutDigest(token())});assert.equal(sameEmail.data,false,'cooldown causes no additional send or link invalidation')
  assert.equal((await consumeBuyerVerification(f.db,{token:secret,proofToken:token()},env)).status,200)
  const unknownId=crypto.randomUUID(),unknown={email:'unknown@invalid.test',requestId:unknownId,challenge:'fixture-challenge-'+unknownId}
  const failed={challengeTransport:async()=>Response.json({success:true,hostname:'driveshaftcable.com',action:'buyer-checkout-verification',cdata:unknownId,challenge_ts:new Date().toISOString()}),emailTransport:async()=>{throw Error('uncertain fixture transport')}}
  assert.equal((await requestBuyerVerification(f.db,unknown,env,failed)).status,202)
  assert.equal((await f.sql.query("select status from email_attempts where entity_id=$1",[unknownId])).rows[0].status,'uncertain')
  assert.equal((await requestBuyerVerification(f.db,unknown,env,failed)).status,202)
  assert.equal((await f.sql.query('select count(*)::int n from email_attempts')).rows[0].n,2)
 }finally{await f.sql.close()}
})
test('private verification tables and RPCs cannot be read, forged or consumed by browser database roles',async()=>{
 const f=await setup();try{
  const l=await link(f,'private@invalid.test')
  for(const role of ['anon','authenticated']){
   await f.sql.exec('reset role;set role '+role)
   for(const table of ['buyer_verification_requests','buyer_verification_proofs'])await assert.rejects(()=>f.sql.query('select * from '+table),/permission denied/)
   const r=await f.db.rpc('buyer_verification_consume',{p_link_hash:await checkoutDigest(l.secret),p_proof_hash:await checkoutDigest(token())});assert.ok(r.error)
   assert.ok((await f.db.rpc('buyer_verification_valid',{p_email:'private@invalid.test',p_hash:await checkoutDigest(token())})).error)
  }
 }finally{await f.sql.close()}
})
