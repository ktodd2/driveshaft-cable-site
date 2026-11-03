// Actual pricing/composition and effective migrations, synthetic provider transport only.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {createSecurePayment,cancelSecurePayment,normalizeCheckoutInput,reconcileOrderPayment,resumeSecurePayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {syncReferralIntent} from '../../supabase/functions/_shared/referrals.js'
async function setup({policyRuntime=true}={}){
 const f=await commerceFixture({policyRuntime})
 await f.sql.exec('reset role');await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented)values('owner@invalid.test','Owner','paid','confirmed','cash','[]',100,true)");await f.sql.exec('set role service_role;update referral_settings set enabled=true')
 const result=await f.db.rpc('referral_create_partner',{p_actor:f.owner,p_email:'owner@invalid.test',p_name:'Owner',p_code:'SHOP-10',p_generate:false});assert.ifError(result.error);f.partner=result.data.id
 await f.sql.query("update referral_partners set status='active',accepted_at=now() where id=$1",[f.partner]);return f
}
const request=(email='new@invalid.test',code=' shop-10 ')=>( {checkoutId:crypto.randomUUID(),checkoutToken:'b'.repeat(64),customer:{email,name:'Buyer',address1:'123 Fixture Lane',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}],discountCode:'WELCOME5',referralCode:code})
async function priced(f,input){const quote=await f.price(normalizeCheckoutInput(input));return {...input,amount:quote.totalCents}}
const create=(f,input)=>createSecurePayment(f.db,f.stripe,input,f.price,{referralEnabled:true})
async function pay(f,result,at=Math.floor(Date.now()/1000)){
 const id=result.body.clientSecret.split('_secret')[0],event=f.succeed(id,at),intent=f.intents.get(id)
 await reconcileOrderPayment(f.db,f.stripe,intent);await syncReferralIntent(f.db,f.stripe,id,event.created,event.created);return id
}
test('5% referral stacks additively with coupon, excludes shipping/tax and binds one first-order payment',async()=>{
 const f=await setup();try{
  const input=await priced(f,request(' NEW@invalid.test ')),quote=await f.price(normalizeCheckoutInput(input))
  assert.equal(quote.subtotalCents,5000);assert.equal(quote.baseDiscountCents,250);assert.equal(quote.referralDiscountCents,250);assert.equal(quote.discountCents,500);assert.equal(quote.totalCents,6875);assert.equal(f.taxes.at(-1).line_items[0].amount,4500)
  const result=await create(f,input);assert.equal(result.status,200);assert.equal((await create(f,input)).body.orderId,result.body.orderId)
  const other=await priced(f,request('new@invalid.test',null));await assert.rejects(()=>create(f,other),/unfinished first-order/)
  assert.equal(f.intents.size,1);const id=await pay(f,result)
  assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,0)
  const earning=(await f.sql.query('select * from referral_earnings')).rows[0];assert.equal(earning.base_cents,4500);assert.equal(earning.original_cents,450);assert.equal(earning.rate_bps,1000);assert.equal(earning.sequence,1)
  await assert.rejects(()=>priced(f,request()),/referral code/)
  await f.sql.query('select referral_adjust($1,6875,false,200)',[id]);assert.equal((await f.sql.query('select merchandise_refund_cents from referral_earnings')).rows[0].merchandise_refund_cents,4500)
  assert.equal((await f.sql.query('select rate_bps from referral_earnings')).rows[0].rate_bps,1000,'refund uses original immutable rate')
 }finally{await f.sql.close()}
})
test('buyer cancellation releases only a provider-confirmed cancelled checkout; abandoned/failed/processing claims never expire',async()=>{
 const f=await setup();try{
  const a=await priced(f,request('reserved@invalid.test',null)),first=await create(f,a),second=await priced(f,request('reserved@invalid.test'))
  await f.sql.exec("update referral_first_checkouts set created_at=now()-interval '30 days'")
  await assert.rejects(()=>create(f,second),/unfinished first-order/)
  await assert.rejects(()=>cancelSecurePayment(f.db,f.stripe,{...a,checkoutToken:'c'.repeat(64)}),/unavailable/)
  const intent=f.intents.get(first.body.clientSecret.split('_secret')[0]);intent.status='processing'
  assert.equal((await cancelSecurePayment(f.db,f.stripe,a)).status,409);assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,1)
  intent.status='requires_payment_method'
  assert.equal((await cancelSecurePayment(f.db,f.stripe,a)).body.status,'cancelled');assert.equal(intent.status,'canceled')
  assert.equal((await cancelSecurePayment(f.db,f.stripe,a)).body.status,'cancelled','lost cancellation response recovers without another provider call')
  await assert.rejects(()=>create(f,a),/cancelled/)
  const next=await create(f,second);await pay(f,next);assert.equal((await f.sql.query('select sequence from referral_earnings')).rows[0].sequence,1)
 }finally{await f.sql.close()}
})
test('new per-code schedules affect future prepared orders for existing buyers, never stored earnings or old prepared orders',async()=>{
 const f=await setup();try{
  const first=await create(f,await priced(f,request('future@invalid.test')));await pay(f,first)
  const before=(await f.sql.query('select rate_bps,original_cents,policy_snapshot from referral_earnings')).rows[0]
  const repeat=await priced(f,request('future@invalid.test',null)),oldPrepared=await create(f,repeat)
  const tiers=[{through:1,bps:999},{through:2,bps:725},{through:20,bps:0}]
  const edit=await f.db.rpc('referral_set_code_policy',{p_actor:f.owner,p_partner:f.partner,p_expected_revision:1,p_discount_bps:800,p_tiers:tiers});assert.ifError(edit.error)
  await pay(f,oldPrepared,Math.floor(Date.now()/1000)+1)
  const future=await create(f,await priced(f,request('future@invalid.test',null)));await pay(f,future,Math.floor(Date.now()/1000)+2)
  const rows=(await f.sql.query('select sequence,rate_bps,original_cents,policy_snapshot from referral_earnings order by sequence')).rows
  assert.equal(rows[0].rate_bps,1000);assert.equal(rows[0].original_cents,before.original_cents);assert.deepEqual(rows[0].policy_snapshot,before.policy_snapshot)
  assert.equal(rows[1].rate_bps,500,'checkout prepared before edit keeps its terms')
  assert.equal(rows[2].rate_bps,0,'new order for already linked buyer uses new code policy')
  assert.equal(rows[2].policy_snapshot.revision,2)
 }finally{await f.sql.close()}
})
test('default order 20 earns 1%, order 21 earns zero, with sequence and attribution retained',async()=>{
 const f=await setup();try{
  const first=await create(f,await priced(f,request('boundary@invalid.test')));await pay(f,first)
  await f.sql.query("update referral_buyers set next_sequence=20 where email='boundary@invalid.test'")
  const twentieth=await create(f,await priced(f,request('boundary@invalid.test',null)));await pay(f,twentieth,Math.floor(Date.now()/1000)+1)
  const last=await create(f,await priced(f,request('boundary@invalid.test',null)));await pay(f,last,Math.floor(Date.now()/1000)+2)
  assert.deepEqual((await f.sql.query('select sequence,rate_bps from referral_earnings order by sequence')).rows,[{sequence:1,rate_bps:1000},{sequence:20,rate_bps:100},{sequence:21,rate_bps:0}])
  assert.equal((await f.sql.query("select next_sequence from referral_buyers where email='boundary@invalid.test'")).rows[0].next_sequence,22)
 }finally{await f.sql.close()}
})
test('policy edit between pricing and atomic preparation rejects stale discount before any payable intent or claim',async()=>{
 const f=await setup();try{
  const input=await priced(f,request('stale@invalid.test')),quote=await f.price(normalizeCheckoutInput(input))
  const edit=await f.db.rpc('referral_set_code_policy',{p_actor:f.owner,p_partner:f.partner,p_expected_revision:1,p_discount_bps:800,p_tiers:[{through:20,bps:300}]});assert.ifError(edit.error)
  await assert.rejects(()=>createSecurePayment(f.db,f.stripe,input,async()=>quote,{referralEnabled:true}),/Code settings changed/)
  assert.equal(f.intents.size,0);assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,0)
  const revised=await priced(f,request('stale@invalid.test'));const result=await create(f,revised);await pay(f,result)
  assert.equal((await f.sql.query('select rate_bps from referral_earnings')).rows[0].rate_bps,300)
 }finally{await f.sql.close()}
})
test('absent cancellation tombstone suppresses a delayed in-flight checkout before any provider intent',async()=>{
 const f=await setup();try{
  const input=await priced(f,request('delayed@invalid.test')),quote=await f.price(normalizeCheckoutInput(input));let entered,release
  const reached=new Promise(resolve=>entered=resolve),barrier=new Promise(resolve=>release=resolve)
  const pending=createSecurePayment(f.db,f.stripe,input,async()=>{entered();await barrier;return quote},{referralEnabled:true}).then(result=>({result}),error=>({error:error.message}))
  await reached;assert.equal((await cancelSecurePayment(f.db,f.stripe,input)).body.status,'cancelled');release()
  assert.match((await pending).error,/cancelled or cancellation is pending/);assert.equal(f.intents.size,0)
  assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,0)
  assert.equal((await f.sql.query('select count(*)::int n from checkout_cancellations')).rows[0].n,1)
 }finally{await f.sql.close()}
})
test('old unbound payment reference stays held during cancellation without recreating its intent after the retry window',async()=>{
 const f=await setup();try{
  const input=await priced(f,request('uncertain@invalid.test')),provider=f.stripe.paymentIntents.create
  f.stripe.paymentIntents.create=async()=>{throw Error('uncertain synthetic provider response')}
  await assert.rejects(()=>create(f,input),/uncertain/);f.stripe.paymentIntents.create=provider
  await f.sql.query("update checkout_requests set created_at=now()-interval '24 hours' where id=$1",[input.checkoutId])
  const result=await cancelSecurePayment(f.db,f.stripe,input);assert.equal(result.status,409);assert.match(result.body.error,/uncertain provider reference/)
  assert.equal(f.intents.size,0);assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,1)
 }finally{await f.sql.close()}
})
test('private resume restores frozen details after policy edits; cancellation-pending paid/processing status remains recoverable',async()=>{
 const f=await setup();try{
  const input=await priced(f,request('resume@invalid.test')),created=await create(f,input),id=created.body.clientSecret.split('_secret')[0]
  await f.db.rpc('referral_set_code_policy',{p_actor:f.owner,p_partner:f.partner,p_expected_revision:1,p_discount_bps:800,p_tiers:[{through:20,bps:725}]})
  await assert.rejects(()=>resumeSecurePayment(f.db,f.stripe,{...input,checkoutToken:'c'.repeat(64)}),/unavailable/)
  const resumed=await resumeSecurePayment(f.db,f.stripe,input);assert.equal(resumed.body.clientSecret,created.body.clientSecret);assert.equal(resumed.body.checkout.pricing.totalCents,6875);assert.equal(resumed.body.checkout.customer.email,'resume@invalid.test');assert.equal(f.intents.size,1)
  const intent=f.intents.get(id);intent.status='processing'
  assert.equal((await cancelSecurePayment(f.db,f.stripe,input)).status,409)
  assert.equal((await resumeSecurePayment(f.db,f.stripe,input)).body.status,'processing')
  f.succeed(id);const paid=await cancelSecurePayment(f.db,f.stripe,input);assert.equal(paid.body.status,'paid');assert.equal(paid.body.clientSecret,created.body.clientSecret)
  assert.equal((await resumeSecurePayment(f.db,f.stripe,input)).body.status,'succeeded');assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,0)
  assert.equal((await f.sql.query('select status from orders where id=$1',[created.body.orderId])).rows[0].status,'confirmed')
 }finally{await f.sql.close()}
})
test('legacy cancelled display status and NULL payment status cannot release unverified payable first-order history',async()=>{
 const f=await setup();try{
  for(const [email,status] of [['legacy-cancelled@invalid.test','pending'],['legacy-null@invalid.test',null]]){
   await f.sql.exec('reset role');await f.sql.query("insert into orders(email,payment_status,status,payment_method,items,total_cents) values($1,$2,'cancelled','stripe','[]',100)",[email,status]);await f.sql.exec('set role service_role')
   const input=await priced(f,request(email));await assert.rejects(()=>create(f,input),/earlier payment needs verification/)
  }
  assert.equal(f.intents.size,0)
 }finally{await f.sql.close()}
})
test('lost-capability recovery requires active admin and cancels only an unpaid provider-bound checkout',async()=>{
 const f=await setup();try{
  const input=await priced(f,request('lost@invalid.test'));await create(f,input)
  await assert.rejects(()=>cancelSecurePayment(f.db,f.stripe,{checkoutId:input.checkoutId},{actorId:crypto.randomUUID()}),/unavailable/)
  assert.equal((await f.sql.query('select count(*)::int n from checkout_cancellations')).rows[0].n,0)
  const result=await cancelSecurePayment(f.db,f.stripe,{checkoutId:input.checkoutId},{actorId:f.owner});assert.equal(result.body.status,'cancelled');assert.equal(result.body.clientSecret,undefined)
  assert.equal((await f.sql.query("select count(*)::int n from referral_audit where action='checkout_cancel_requested'")).rows[0].n,1)
 }finally{await f.sql.close()}
})
test('private invite preview shows only this code policy and stale acceptance cannot consume the invite',async()=>{
 const f=await setup();try{
  const hash='d'.repeat(64);await f.sql.query("update referral_partners set status='invited' where id=$1",[f.partner]);await f.sql.query("insert into referral_invites(partner_id,token_hash,expires_at)values($1,$2,now()+interval '7 days')",[f.partner,hash])
  const preview=(await f.db.rpc('referral_invite_preview',{p_hash:hash})).data;assert.equal(preview.revision,1);assert.equal(preview.buyer_discount_bps,500);assert.equal(preview.tiers.at(-1).through,20)
  assert.deepEqual(Object.keys(preview).sort(),['buyer_discount_bps','code','revision','tiers'])
  await f.db.rpc('referral_set_code_policy',{p_actor:f.owner,p_partner:f.partner,p_expected_revision:1,p_discount_bps:750,p_tiers:[{through:20,bps:250}]})
  const args={p_hash:hash,p_name:'Referrer',p_address:'Synthetic mailing address',p_preference:'product',p_revision:1}
  assert.match((await f.db.rpc('referral_signup_policy',args)).error.message,/settings changed/)
  assert.equal((await f.sql.query('select used_at from referral_invites')).rows[0].used_at,null)
  assert.ifError((await f.db.rpc('referral_signup_policy',{...args,p_revision:2})).error)
  assert.ok((await f.db.rpc('referral_invite_preview',{p_hash:hash})).error)
 }finally{await f.sql.close()}
})
test('100% stacked product cap never creates an unsupported zero-total/free-shipping payment',async()=>{
 const f=await setup();try{
  await f.db.rpc('referral_set_code_policy',{p_actor:f.owner,p_partner:f.partner,p_expected_revision:1,p_discount_bps:10000,p_tiers:[{through:20,bps:1000}]})
  f.stripe.tax.calculations.create=async params=>{f.taxes.push(params);return {id:'taxcalc_zero',tax_amount_exclusive:0}}
  const input=request('zero@invalid.test');input.items[0].quantity=200
  await assert.rejects(()=>priced(f,input),/total zero.*Contact us/)
  assert.equal(f.taxes[0].line_items[0].amount,0);assert.equal(f.intents.size,0)
 }finally{await f.sql.close()}
})
test('uncoded pre-migration checkouts inherit legacy terms when the first payment permanently links the buyer',async()=>{
 const f=await setup({policyRuntime:false});try{
  const a=await create(f,await priced(f,request('legacy-policy@invalid.test'))),b=await create(f,await priced(f,request('legacy-policy@invalid.test',null)))
  await f.sql.exec('reset role')
  for(const name of ['20261103143717_referral_code_policy.sql','20261103143732_referral_policy_checkout_runtime.sql'])await f.sql.exec(await fs.readFile('supabase/migrations/'+name,'utf8'))
  await f.sql.exec('set role service_role')
  const at=Math.floor(Date.now()/1000)+1;await pay(f,a,at);await pay(f,b,at+1)
  const rows=(await f.sql.query('select sequence,rate_bps,policy_snapshot from referral_earnings order by sequence')).rows
  assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>[row.sequence,row.rate_bps]),[[1,1000],[2,500]])
  assert.ok(rows.every(row=>row.policy_snapshot.legacy===true&&row.policy_snapshot.partner_id===f.partner))
 }finally{await f.sql.close()}
})
test('nullable legacy payment method remains held, including a known Stripe reference',async()=>{
 const f=await setup();try{
  for(const [email,intent] of [['null-method@invalid.test',null],['known-intent@invalid.test','pi_legacy_fixture']]){
   await f.sql.exec('reset role');await f.sql.query("insert into orders(email,payment_status,status,payment_method,stripe_payment_intent_id,items,total_cents) values($1,'pending','cancelled',null,$2,'[]',100)",[email,intent]);await f.sql.exec('set role service_role')
   await assert.rejects(async()=>create(f,await priced(f,request(email))),/earlier payment needs verification/)
  }
  assert.equal(f.intents.size,0)
 }finally{await f.sql.close()}
})
test('refund after issuance still deducts the immutable original commission after the code rate changes',async()=>{
 const f=await setup();try{
  const first=await create(f,await priced(f,request('refund-edit@invalid.test'))),intent=await pay(f,first)
  await f.sql.exec("update referral_earnings set available_at=now()-interval '1 day'")
  const redemption=crypto.randomUUID(),admin=async(action,data)=>{const result=await f.db.rpc('referral_admin',{p_actor:f.owner,p_action:action,p_data:data});assert.ifError(result.error)}
  await admin('request',{id:redemption,partner_id:f.partner,kind:'check',merchandise_cents:450,shipping_cents:0,tax_cents:0,notes:'Synthetic owner-approved fixture'})
  await admin('approve',{id:redemption});await admin('complete',{id:redemption,reference:'Synthetic check fixture'})
  await f.db.rpc('referral_set_code_policy',{p_actor:f.owner,p_partner:f.partner,p_expected_revision:1,p_discount_bps:0,p_tiers:[{through:20,bps:0}]})
  await f.sql.query('select referral_adjust($1,6875,false,200)',[intent])
  const balance=(await f.sql.query('select referral_balance($1) balance',[f.partner])).rows[0].balance
  assert.equal(balance.available,-450);assert.equal(balance.reversed,450)
  assert.equal((await f.sql.query('select rate_bps from referral_earnings')).rows[0].rate_bps,1000)
 }finally{await f.sql.close()}
})
test('active owner exact-email lookup reaches a lost checkout beyond the first 200 unresolved holds',async()=>{
 const f=await setup();try{
  const input=await priced(f,request('lost-beyond-queue@invalid.test'));await create(f,input)
  await f.sql.exec(`WITH inserted AS (INSERT INTO orders(email,payment_status,status,payment_method,items,total_cents) SELECT 'hold-'||n||'@invalid.test','pending','pending','stripe','[]',100 FROM generate_series(1,201)n RETURNING id,email), snapshots AS (INSERT INTO checkout_requests(id,capability_hash,fingerprint,order_id,order_snapshot,intent_params) SELECT gen_random_uuid(),repeat('a',64),repeat('b',64),id,jsonb_build_object('email',email),'{}' FROM inserted RETURNING id,order_snapshot) INSERT INTO referral_first_checkouts(email,checkout_id,created_at) SELECT order_snapshot->>'email',id,now()-interval '1 day' FROM snapshots;`)
  const list=(await f.db.rpc('referral_first_checkout_list',{p_actor:f.owner,p_email:null})).data
  assert.equal(list.rows.length,200);assert.equal(list.has_more,true);assert.ok(!list.rows.some(row=>row.email==='lost-beyond-queue@invalid.test'))
  const found=(await f.db.rpc('referral_first_checkout_list',{p_actor:f.owner,p_email:' LOST-BEYOND-QUEUE@invalid.test '})).data
  assert.equal(found.rows.length,1);assert.equal(found.rows[0].checkout_id,input.checkoutId)
  assert.deepEqual(Object.keys(found.rows[0]).sort(),['checkout_id','created_at','email'])
  assert.ok((await f.db.rpc('referral_first_checkout_list',{p_actor:crypto.randomUUID(),p_email:input.customer.email})).error)
  for(const role of ['anon','authenticated']){
   await f.sql.exec('reset role;set role '+role)
   for(const table of ['referral_first_checkouts','checkout_cancellations','referral_policy_versions'])await assert.rejects(()=>f.sql.query('select * from '+table),/permission denied/)
   assert.ok((await f.db.rpc('referral_first_checkout_list',{p_actor:f.owner,p_email:input.customer.email})).error)
   assert.ok((await f.db.rpc('request_checkout_cancellation',{p_id:input.checkoutId,p_capability_hash:'a'.repeat(64)})).error)
  }
 }finally{await f.sql.close()}
})
