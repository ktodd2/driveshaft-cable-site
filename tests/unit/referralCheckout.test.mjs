// Execute the actual payment endpoint using in-memory catalog/Stripe/DB fixtures.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {runInNewContext} from 'node:vm'
import * as referral from '../../supabase/functions/_shared/referrals.js'
const output=await build({entryPoints:['supabase/functions/create-payment-intent/index.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/https:|_shared\//},args=>({path:args.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:
 path.includes('/http/server')?'export const serve=h.serve;':
 path.includes('stripe@')?'export default class Stripe {constructor(){return h.stripe}}':
 path.includes('emailHealth')?'export const digest=h.digest;':
 path.includes('referrals')?'export const prepareReferralCheckout=h.referral.prepareReferralCheckout,validateReferralRecovery=h.referral.validateReferralRecovery;':
 path.includes('pricing')?'export const computeShipping=()=>2000,createAdminClient=()=>h.db,getPriceForQuantityFromDb=async()=>500,makeDbCache=()=>({});':
 path.includes('discounts')?'export const checkDiscountCode=async()=>({valid:true,code:"WELCOME5",percentOff:5}),isRepeatCustomer=async()=>h.repeat,REPEAT_CUSTOMER_DISCOUNT=0.1;':
 path.includes('/tax')?'export const isAddressTaxable=()=>true,createTaxCalculation=async()=>({taxCents:375,calculationId:"tax_fixture"});':
 path.includes('purchaseAnalytics')?'export const createPurchaseSnapshot=()=>null;':
 'export const analyticsMetadata=()=>({});',loader:'js'}))
}}]})
const orderId='10000000-0000-4000-8000-000000000001',token='a'.repeat(64)
function harness(enabled=true){
 const writes=[],rpcCalls=[],payments=[];let stored=null,handler
 const order={id:orderId,email:' Buyer@invalid.test ',items:[{productId:'1',quantity:10}],shipping_address:{country:'US'},payment_status:'pending',payment_method:'stripe',status:'pending'}
 const db={from(table){let update=false;const q={select(){return q},eq(){return q},in(){return q},update(value){writes.push(value);update=true;return q},single:async()=>({data:table==='orders'?order:{stock_quantity:1000}}),maybeSingle:async()=>({data:stored}),then(ok){return Promise.resolve(update?{}:{data:[{id:'1',name:'Fixture Product'}]}).then(ok)}};return q},rpc:async(name,args)=>{
  rpcCalls.push([name,args]);if(['referral_prepare','referral_prepare_named'].includes(name))stored={order_id:args.p_order,email:args.p_email,state:'prepared',intent_id:stored?.intent_id||null,merchandise_cents:args.p_merch,shipping_cents:args.p_shipping,tax_cents:args.p_tax,total_cents:args.p_merch+args.p_shipping+args.p_tax,intent_params:args.p_params,created_at:new Date().toISOString()}
  if(name==='referral_attach')stored.intent_id=args.p_intent
  return {data:stored}
 }}
 const stripe={paymentIntents:{create:async(params,options)=>{payments.push({params,options});return {id:'pi_fixture',client_secret:'fixture-private'}},retrieve:async()=>({id:'pi_fixture',client_secret:'fixture-private'})}}
 const h={serve:fn=>{handler=fn},db,stripe,repeat:false,referral,digest:async value=>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Buffer.from(bytes).toString('hex')}}
 const module={exports:{}};runInNewContext(output.outputFiles[0].text,{h,module,exports:module.exports,Deno:{env:{get:name=>name==='REFERRAL_REWARDS_ENABLED'&&enabled?'true':''}},console:{error(){},warn(){}},Response,Date,Error,JSON})
 return {order,writes,rpcCalls,payments,h,request:async(overrides={})=>handler(new Request('http://fixture',{method:'POST',body:JSON.stringify({orderId,amount:h.repeat?6875:7375,referralCode:'CODE10',checkoutToken:token,...overrides})}))}
}
test('actual endpoint preserves repeat pricing, tax and shipping and snapshots only discounted product revenue',async()=>{
 const f=harness();f.h.repeat=true
 const response=await f.request({discountCode:'WELCOME5'});assert.equal(response.status,200)
 assert.equal(f.writes[0].discount_cents,500);assert.equal(f.writes[0].shipping_cents,2000);assert.equal(f.writes[0].tax_cents,375)
 assert.equal(f.payments[0].params.amount,6875);assert.equal(f.rpcCalls[0][1].p_merch,4500)
 assert.equal(f.payments[0].params.metadata.referral_system,'v1')
 assert.ok(!JSON.stringify(f.payments).includes(token),'raw checkout capability never reaches Stripe or the database')
 const recovered=await f.request({discountCode:'WELCOME5'});assert.equal(recovered.status,200);assert.equal(f.payments.length,1,'lost response recovers same intent')
 const changed=await f.request({checkoutToken:'b'.repeat(64)});assert.equal(changed.status,409);assert.equal(f.payments.length,1)
})
test('actual endpoint rejects amount tampering, nonretail status and missing checkout capability before payment',async()=>{
 for(const type of ['amount','nonretail','capability']){
  const f=harness();if(type==='nonretail')f.order.status='test'
  const r=await f.request(type==='amount'?{amount:1}:type==='capability'?{checkoutToken:null}:{})
  assert.ok(r.status>=400);assert.equal(f.payments.length,0);assert.equal(f.rpcCalls.length,0)
 }
})
test('disabled referral rollout preserves old payment path and rejects code promises',async()=>{
 const f=harness(false);const r=await f.request({referralCode:null});assert.equal(r.status,200);assert.equal(f.rpcCalls.length,0);assert.equal(f.payments[0].params.metadata.referral_system,undefined)
 const code=await f.request();assert.equal(code.status,409);assert.equal(f.payments.length,1)
})
