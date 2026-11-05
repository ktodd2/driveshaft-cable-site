import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {normalizeCheckoutInput,reconcileOrderPayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {verifiedPurchaseResponse,createPurchaseSnapshot} from '../../supabase/functions/_shared/purchaseAnalytics.js'
const orderId='10000000-0000-4000-8000-000000000001',secret='pi_fixture_secret_private'
function handler(name,values){let fn;const source=readFileSync(`supabase/functions/${name}/index.ts`,'utf8').replace(/^import .*\n/gm,'');runInNewContext(stripTypeScriptTypes(source),{serve:value=>{fn=value},Deno:{env:{get:()=>''}},Response,Request,JSON,Error,Number,Object,Date,console:{error(){}},...values});return fn}
const call=(fn,body,method='POST')=>fn(new Request('http://fixture',{method,...(method==='POST'?{body:JSON.stringify(body)}:{})}))
test('old order-ID-only creation requests reject without reading or mutating any order',async()=>{
 let privileged=0;const fn=handler('create-payment-intent',{Stripe:class{},createAdminClient:()=>{privileged++;throw Error('must not read')},analyticsMetadata(){},createPurchaseSnapshot(){}})
 const response=await call(fn,{orderId,amount:1});assert.equal(response.status,409);assert.equal(privileged,0)
 assert.equal((await call(fn,{},'GET')).status,405)
})
test('quote endpoint returns only prices and minimal repeat flag, never records or customer fields',async()=>{
 const fn=handler('quote-checkout',{Stripe:class{},createAdminClient:()=>({}),normalizeCheckoutInput,priceCheckout:async()=>({subtotalCents:5000,discountCents:500,shippingCents:2000,taxCents:300,totalCents:6800,discountSource:'loyalty',repeat:true,lines:[{productId:'1',quantity:10,unitPrice:500,private:'must not return'}],customer:{email:'private@invalid.test'}})})
 const response=await call(fn,{items:[{productId:'1',quantity:10}],customer:{email:'private@invalid.test'}})
 assert.equal(response.status,200);const body=await response.json();assert.deepEqual(Object.keys(body).sort(),['linePrices','discountCents','discountSource','repeat','shippingCents','subtotalCents','taxCents','taxQuoted','totalCents'].sort());assert.deepEqual(body.linePrices,[{productId:'1',quantity:10,unitPrice:500}]);assert.ok(!JSON.stringify(body).includes('private'));assert.equal(response.headers.get('cache-control'),'no-store')
})
test('actual confirmation endpoint requires matching secret/order before server fulfillment and never reveals PII',async()=>{
 const writes=[];let patch={}
 const intent=()=>({id:'pi_fixture',client_secret:secret,livemode:true,status:'succeeded',currency:'usd',amount:7000,amount_received:7000,receipt_email:'private@invalid.test',latest_charge:{paid:true,amount_refunded:0,disputed:false},metadata:{order_id:orderId,items:'[{"productId":"1","quantity":10}]',ga4_purchase:createPurchaseSnapshot([{productId:'1',quantity:10,unitPrice:500,analyticsName:'Catalog Product'}],5000,0,2000,0)},...patch})
 const db={rpc:async(name,args)=>{writes.push({name,args});return {data:name==='claim_order_tax'?null:{status:'paid'}}}}
 const fn=handler('verify-purchase',{Stripe:class{constructor(){this.paymentIntents={retrieve:async()=>intent()}}},createAdminClient:()=>db,reconcileOrderPayment,verifiedPurchaseResponse})
 assert.equal((await call(fn,{orderId,clientSecret:'pi_fixture_secret_wrong'})).status,403);assert.equal(writes.length,0)
 assert.equal((await call(fn,{orderId,redirect_status:'succeeded'})).status,400);assert.equal(writes.length,0)
 patch={status:'processing'};assert.equal((await (await call(fn,{orderId,clientSecret:secret})).json()).status,'pending');assert.equal(writes.length,0)
 patch={latest_charge:null};assert.equal((await call(fn,{orderId,clientSecret:secret})).status,503);assert.equal(writes.length,0)
 patch={livemode:false};assert.equal((await call(fn,{orderId,clientSecret:secret})).status,503);assert.equal(writes.length,0)
 patch={};const response=await call(fn,{orderId,clientSecret:secret});assert.equal(response.status,200);assert.equal(writes[0].name,'apply_verified_order_payment');assert.equal(writes[0].args.p_email,'private@invalid.test');const body=await response.text();assert.ok(!body.includes('private@'));assert.ok(!body.includes(secret));assert.equal(response.headers.get('cache-control'),'no-store')
 patch={metadata:{order_id:'different'}};assert.equal((await call(fn,{orderId,clientSecret:secret})).status,403)
})
