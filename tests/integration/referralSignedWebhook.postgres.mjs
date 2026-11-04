// Actual production handler + Stripe signature implementation + ephemeral SQL.
// All provider data/operations and email transports are offline fixtures. No HTTP.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {createHmac} from 'node:crypto'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {fixtureSigningKey,solvedBuyerChallenge} from '../fixtures/buyerProofOfWork.mjs'
import {requestBuyerVerification,consumeBuyerVerification} from '../../supabase/functions/_shared/buyerVerification.js'
import {createSecurePayment,normalizeCheckoutInput,reconcileOrderPayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {handleReferralEvent} from '../../supabase/functions/_shared/referrals.js'
const {default:StripeSdk}=await import(process.env.STRIPE_SERVER_MODULE||'stripe')
const signingSecret='offline-fixture-only-not-a-provider-webhook-secret'
const random=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')
const env={get:key=>({SUPABASE_URL:'https://twrihhyfvomqiqbxkitc.supabase.co',STORE_SUPABASE_SECRET_KEY:fixtureSigningKey,RESEND_API_KEY:'offline-fixture-only',BUYER_EMAIL_VERIFICATION_ENABLED:'true',BUYER_VERIFICATION_EMAILS_ENABLED:'true',STRIPE_WEBHOOK_SECRET:signingSecret}[key])}
async function setup(){
 const f=await commerceFixture({policyRuntime:true,emailVerification:true})
 await f.sql.exec('reset role');await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented)values('owner@invalid.test','Owner','paid','confirmed','cash','[]',100,true)");await f.sql.exec('set role service_role;update referral_settings set enabled=true,buyer_verification_emails_enabled=true')
 const partner=await f.db.rpc('referral_create_partner',{p_actor:f.owner,p_email:'owner@invalid.test',p_name:'Owner',p_code:'SIGNED-TEST',p_generate:false});assert.ifError(partner.error);f.partner=partner.data.id
 await f.sql.query("update referral_partners set status='active',accepted_at=now() where id=$1",[f.partner])
 const sdk=new StripeSdk('sk_test_offline_fixture_never_used_for_api_calls')
 f.stripe.webhooks=sdk.webhooks
 class Stripe {constructor(){return f.stripe}static createSubtleCryptoProvider(){return StripeSdk.createSubtleCryptoProvider()}}
 let handler
 const source=readFileSync('supabase/functions/stripe-webhook/index.ts','utf8').replace(/^import .*\n/gm,'')
 runInNewContext(stripTypeScriptTypes(source),{serve:fn=>handler=fn,Stripe,createApiClient:()=>f.db,createClient(){throw Error('No network client allowed')},getSupabaseSecretKey:()=>fixtureSigningKey,reconcileOrderPayment,handleReferralEvent,Deno:{env},Response,JSON,Error})
 f.deliver=async(event,{tampered=false,timestamp=Math.floor(Date.now()/1000)}={})=>{
  const body=JSON.stringify(event),signature=`t=${timestamp},v1=${createHmac('sha256',signingSecret).update(`${timestamp}.${body}`).digest('hex')}`
  return handler(new Request('http://offline.invalid',{method:'POST',headers:{'stripe-signature':signature},body:tampered?body+' ':body}))
 }
 f.admin=async(action,data)=>{const r=await f.db.rpc('referral_admin',{p_actor:f.owner,p_action:action,p_data:data});assert.ifError(r.error);return r.data}
 return f
}
test('real signed production handler composes email proof, positive tax, payment replay, refund review, payout and post-payout negative adjustment',async()=>{
 const f=await setup();try{
  const email='signed-buyer@invalid.test',requestId=crypto.randomUUID(),link=random(),proof=random(),captured=[]
  const challenge=await solvedBuyerChallenge(email,requestId)
  const requested=await requestBuyerVerification(f.db,{email,requestId,challenge},env,{randomToken:()=>link,emailTransport:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');captured.push(JSON.parse(options.body));return Response.json({id:'offline-intercepted'})}})
  assert.equal(requested.status,202);assert.equal(captured.length,1);assert.equal(captured[0].to,email)
  assert.equal((await consumeBuyerVerification(f.db,{token:link,proofToken:proof},env)).status,200)
  const input={checkoutId:crypto.randomUUID(),checkoutToken:random(),buyerVerificationToken:proof,customer:{email,name:'Signed Buyer',address1:'123 Fixture Lane',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}],discountCode:'WELCOME5',referralCode:'SIGNED-TEST'}
  const quote=await f.price(normalizeCheckoutInput(input));input.amount=quote.totalCents
  assert.equal(quote.subtotalCents,5000);assert.equal(quote.discountCents,500);assert.equal(quote.taxCents,375);assert.equal(quote.shippingCents,2000);assert.equal(quote.totalCents,6875)
  assert.equal(f.taxes.at(-1).line_items[0].amount,4500)
  const made=await createSecurePayment(f.db,f.stripe,input,f.price,{referralEnabled:true});assert.equal(made.status,200)
  const intentId=made.body.clientSecret.split('_secret')[0],event=f.succeed(intentId),intent=f.intents.get(intentId)
  assert.equal((await f.deliver(event,{tampered:true})).status,400)
  assert.equal((await f.deliver(event,{timestamp:Math.floor(Date.now()/1000)-600})).status,400)
  assert.equal((await f.sql.query('select count(*)::int n from referral_earnings')).rows[0].n,0)
  assert.equal((await f.sql.query("select stock_quantity from product_inventory where product_id='1'")).rows[0].stock_quantity,100000)
  intent.livemode=false;const ignored=await f.deliver({...event,livemode:false});assert.equal(ignored.status,200);assert.equal((await ignored.json()).ignored,true)
  assert.equal((await f.sql.query('select count(*)::int n from referral_earnings')).rows[0].n,0,'production never awards test-mode events')
  assert.equal((await f.sql.query("select stock_quantity from product_inventory where product_id='1'")).rows[0].stock_quantity,100000)
  assert.equal((await f.deliver(event)).status,503,'even a signed live-shaped event cannot reconcile an authoritative test intent')
  assert.equal((await f.sql.query("select stock_quantity from product_inventory where product_id='1'")).rows[0].stock_quantity,100000)
  intent.livemode=true
  assert.equal((await f.deliver(event)).status,200);assert.equal((await f.deliver(event)).status,200)
  assert.equal((await f.deliver({...event,id:'evt_stale_failure',type:'payment_intent.payment_failed'})).status,200)
  assert.equal((await f.sql.query("select stock_quantity from product_inventory where product_id='1'")).rows[0].stock_quantity,99990)
  const earning=(await f.sql.query('select * from referral_earnings')).rows[0]
  assert.equal(earning.base_cents,4500);assert.equal(earning.original_cents,450);assert.equal(earning.rate_bps,1000);assert.equal(earning.sequence,1)
  intent.latest_charge.amount_refunded=1000
  const refund={id:'evt_partial_refund',type:'charge.refunded',livemode:true,created:event.created+1,data:{object:{payment_intent:intentId}}}
  assert.equal((await f.deliver(refund)).status,200)
  assert.equal((await f.sql.query('select refund_review from referral_earnings')).rows[0].refund_review,true)
  await f.admin('refund',{order_id:made.body.orderId,refunded_total_cents:1000,merchandise_cents:1000})
  // Simulate passage of eight days without waiting or touching any hosted row.
  await f.sql.exec("update referral_earnings set paid_at=paid_at-interval '8 days',available_at=available_at-interval '8 days'")
  const redemption=crypto.randomUUID()
  await f.admin('request',{id:redemption,partner_id:f.partner,kind:'check',merchandise_cents:350,shipping_cents:0,tax_cents:0,notes:'Offline issuance record only'})
  await f.admin('approve',{id:redemption});await f.admin('complete',{id:redemption,reference:'OFFLINE FIXTURE — no check sent'})
  intent.latest_charge.amount_refunded=intent.amount
  assert.equal((await f.deliver({...refund,id:'evt_full_refund',created:event.created+2})).status,200)
  assert.equal((await f.deliver({...refund,id:'evt_out_of_order',created:event.created})).status,200)
  const balance=(await f.sql.query('select referral_balance($1,now()) b',[f.partner])).rows[0].b
  assert.equal(Number(balance.paid),350);assert.equal(Number(balance.available),-350);assert.equal(Number(balance.reversed),450)
  const final=(await f.sql.query('select sequence,rate_bps,merchandise_refund_cents from referral_earnings')).rows[0]
  assert.deepEqual(final,{sequence:1,rate_bps:1000,merchandise_refund_cents:4500})
 }finally{await f.sql.close()}
})
