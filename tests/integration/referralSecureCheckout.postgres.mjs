// Execute actual composed endpoints + server helpers over local PostgreSQL and provider fixtures.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {createSecurePayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {createPurchaseSnapshot} from '../../supabase/functions/_shared/purchaseAnalytics.js'
function endpoint(f,enabled=true,name='create-secure-checkout'){
 let handler
 class Stripe{constructor(){return f.stripe}}
 const source=readFileSync(`supabase/functions/${name}/index.ts`,'utf8').replace(/^import .*\n/gm,'')
 runInNewContext(stripTypeScriptTypes(source),{serve:fn=>{handler=fn},Stripe,createAdminClient:()=>f.db,createSecurePayment,priceCheckout:(_db,_stripe,input)=>f.price(input),createPurchaseSnapshot,analyticsMetadata:()=>({}),Deno:{env:{get:key=>key==='REFERRAL_REWARDS_ENABLED'&&enabled?'true':''}},Response,JSON,Error})
 return body=>handler(new Request('http://fixture',{method:'POST',body:JSON.stringify(body)}))
}
const input=(email='new@invalid.test',code='SHOP-10')=>({checkoutId:crypto.randomUUID(),checkoutToken:'a'.repeat(64),customer:{email,name:'Named Buyer',phone:'5551234567',address1:'123 Fixture Lane',address2:'',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}],amount:7375,referralCode:code})
async function partner(f){await f.sql.exec('reset role');await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented) values('owner@invalid.test','Owner','paid','confirmed','cash','[]',100,true)");await f.sql.exec('set role service_role');await f.sql.exec('update referral_settings set enabled=true');const {data,error}=await f.db.rpc('referral_create_partner',{p_actor:f.owner,p_email:'owner@invalid.test',p_name:'Owner',p_code:' shop-10 ',p_generate:false});assert.ifError(error);await f.sql.query("update referral_partners set status='active',accepted_at='2026-10-01T05:00:00Z' where id=$1",[data.id]);return data}
test('composed endpoint preserves retail/discount/tax pricing and one shared named referral payment identity',async()=>{
 const f=await commerceFixture();try{const owner=await partner(f),request=input();const call=endpoint(f)
 const result=await call(request);assert.equal(result.status,200);const first=await result.json()
 assert.equal(f.payments.length,1);assert.ok(f.payments[0].idempotencyKey.startsWith('secure-checkout/'));assert.equal(f.payments[0].params.amount,7375)
 const secure=(await f.sql.query('select * from checkout_requests where id=$1',[request.checkoutId])).rows[0],ref=(await f.sql.query('select * from referral_checkouts where order_id=$1',[first.orderId])).rows[0]
 assert.equal(ref.partner_id,owner.id);assert.equal(ref.buyer_name,'Named Buyer');assert.equal(ref.buyer_name_captured,true);assert.equal(ref.merchandise_cents,5000);assert.equal(ref.shipping_cents,2000);assert.equal(ref.tax_cents,375)
 assert.deepEqual(ref.intent_params,secure.intent_params);assert.equal(ref.intent_id,secure.intent_id);assert.equal(secure.intent_params.metadata.referral_system,'v1');assert.equal(secure.intent_params.metadata.referral_code,'SHOP-10');assert.ok(!JSON.stringify(secure).includes(request.checkoutToken))
 assert.equal((await call(request)).status,200);assert.equal(f.payments.length,1,'lost response cannot create a second intent/key')
 assert.equal((await call({...request,referralCode:'OTHER'})).status,409);assert.equal(f.payments.length,1,'code is immutable fingerprint input')
 const repeat=input('repeat@invalid.test',null);repeat.amount=6875
 await f.sql.exec('reset role');await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented)values('repeat@invalid.test','Repeat','paid','confirmed','cash','[]',100,true)");await f.sql.exec('set role service_role')
 assert.equal((await call(repeat)).status,200);const repeatOrder=(await f.sql.query('select * from checkout_requests where id=$1',[repeat.checkoutId])).rows[0]
 assert.equal(repeatOrder.order_snapshot.discount_cents,500);assert.equal(repeatOrder.order_snapshot.total_cents,6875);assert.equal((await f.sql.query('select merchandise_cents from referral_checkouts where order_id=$1',[repeatOrder.order_id])).rows[0].merchandise_cents,4500)
 }finally{await f.sql.close()}
})
test('composed rollout and intake reject false code promises, arbitrary order IDs and tampering without creating payments',async()=>{
 const f=await commerceFixture();try{await partner(f);const call=endpoint(f,false),normal=input('new@invalid.test',null)
 assert.equal((await call(normal)).status,200);assert.equal(f.payments[0].params.metadata.referral_system,undefined);assert.equal((await f.sql.query('select count(*)::int n from referral_checkouts')).rows[0].n,0)
 assert.equal((await call(input())).status,409);assert.equal((await call({...input(),orderId:crypto.randomUUID()})).status,409)
 for(const value of [{checkoutToken:null},{amount:1},{items:[{productId:'1',quantity:-1}]}])assert.ok((await endpoint(f)({...input(),...value})).status>=400)
 assert.equal(f.payments.length,1)
 }finally{await f.sql.close()}
})

import {reconcileOrderPayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {handleReferralEvent} from '../../supabase/functions/_shared/referrals.js'
function webhook(f){let handler;class Stripe{constructor(){return f.stripe}static createSubtleCryptoProvider(){return {}}};f.stripe.webhooks={constructEventAsync:async(body,signature)=>{if(signature!=='fixture-verified')throw Error('invalid');return JSON.parse(body)}};const source=readFileSync('supabase/functions/stripe-webhook/index.ts','utf8').replace(/^import .*\n/gm,'');runInNewContext(stripTypeScriptTypes(source),{serve:fn=>handler=fn,Stripe,createApiClient:()=>f.db,createClient(){},getSupabaseSecretKey:()=>'',reconcileOrderPayment,handleReferralEvent,Deno:{env:{get:()=>''}},Response,JSON,Error});return event=>handler(new Request('http://fixture',{method:'POST',headers:{'stripe-signature':'fixture-verified'},body:JSON.stringify(event)}))}
test('composed signed webhook reconciles secure stock/payment once, holds out-of-order rewards, refunds and freezes named statements privately',async()=>{
 const f=await commerceFixture();try{const owner=await partner(f),call=endpoint(f),deliver=webhook(f),first=input('ordered@invalid.test'),second=input('ordered@invalid.test',null)
 const a=await(await call(first)).json(),b=await(await call(second)).json();assert.equal(f.payments.length,2,'same email ordinary checkouts never blocked')
 await f.sql.query("update referral_checkouts set created_at=now()-interval '10 days' where email='ordered@invalid.test'")
 const time=Math.floor(Date.now()/1000)-8*86400,eventA=f.succeed(a.clientSecret.split('_secret')[0],time),eventB=f.succeed(b.clientSecret.split('_secret')[0],time+60)
 // Deliver second first: authoritative observation of first cannot infer signed success time.
 assert.equal((await deliver(eventB)).status,200);assert.equal((await f.sql.query('select count(*)::int n from referral_earnings')).rows[0].n,0)
 assert.equal((await deliver(eventA)).status,200)
 for(const event of [eventA,eventB,eventA])assert.equal((await deliver(event)).status,200)
 assert.equal((await f.sql.query("select stock_quantity from product_inventory where product_id='1'")).rows[0].stock_quantity,99980)
 assert.equal((await f.sql.query('select count(*)::int n from order_payment_receipts')).rows[0].n,2)
 assert.deepEqual((await f.sql.query('select sequence,rate_bps,base_cents from referral_earnings order by sequence')).rows,[{sequence:1,rate_bps:1000,base_cents:5000},{sequence:2,rate_bps:500,base_cents:5000}])
 // Stale failed delivery retrieves current paid state, never resets fulfillment.
 assert.equal((await deliver({...eventA,type:'payment_intent.payment_failed'})).status,200)
 const intent=f.intents.get(a.clientSecret.split('_secret')[0]);intent.latest_charge.amount_refunded=1000
 assert.equal((await deliver({id:'evt_refund',type:'charge.refunded',livemode:true,created:time+120,data:{object:{payment_intent:intent.id}}})).status,200)
 const admin=async(action,data)=>{const r=await f.db.rpc('referral_admin',{p_actor:f.owner,p_action:action,p_data:data});assert.ifError(r.error);return r.data}
 await admin('refund',{order_id:a.orderId,refunded_total_cents:1000,merchandise_cents:1000})
 assert.equal((await f.sql.query('select merchandise_refund_cents from referral_earnings where order_id=$1',[a.orderId])).rows[0].merchandise_refund_cents,1000)
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit'}).format(new Date()),details=(await f.sql.query('select referral_customer_statement($1,$2,now()) d',[owner.id,month])).rows[0].d
 assert.equal(details.customers.length,1);assert.equal(details.customers[0].name,'Named Buyer');assert.equal(details.customers[0].lifetime.commission_cents,650)
 for(const secret of ['ordered@invalid.test','shipping_address','payment_intent_id','shipping_cents','tax_cents'])assert.ok(!JSON.stringify(details).includes(secret))
 await f.sql.exec("update referral_settings set emails_enabled=true,auto_statements_enabled=true,statements_started_at=now()-interval '40 days'")
 await f.sql.query('select referral_prepare_statements(now(),200,true)');const frozen=(await f.sql.query('select id,customer_details from referral_statements where partner_id=$1 and month=$2',[owner.id,month])).rows[0];assert.deepEqual(frozen.customer_details,{...details,as_of:frozen.customer_details.as_of})
 intent.latest_charge.amount_refunded=intent.amount;assert.equal((await deliver({id:'evt_fullrefund',type:'charge.refunded',livemode:true,created:time+180,data:{object:{payment_intent:intent.id}}})).status,200)
 assert.deepEqual((await f.sql.query('select customer_details from referral_statements where id=$1',[frozen.id])).rows[0].customer_details,frozen.customer_details)
 assert.deepEqual((await f.sql.query('select sequence,rate_bps from referral_earnings order by sequence')).rows,[{sequence:1,rate_bps:1000},{sequence:2,rate_bps:500}])
 for(const role of ['anon','authenticated']){await f.sql.exec('reset role;set role '+role);await assert.rejects(()=>f.sql.query('select * from checkout_requests'),/permission denied/);await assert.rejects(()=>f.sql.query('select * from referral_earnings'),/permission denied/);const read=await f.sql.query('select * from orders').catch(error=>({error}));assert.ok(read.error||read.rows.length===0);const write=await f.sql.query("update orders set payment_status='paid' returning id").catch(error=>({error}));assert.ok(write.error||write.rows.length===0)}
 }finally{await f.sql.close()}
})
