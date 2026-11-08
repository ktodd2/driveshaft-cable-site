import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizeCheckoutInput,checkoutIdentity,createSecurePayment,reconcileOrderPayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {getOrCreateCheckoutDraft,rememberCheckoutPayment,clearPurchasedCart} from '../../src/lib/checkoutPayment.js'
const id='10000000-0000-4000-8000-000000000001',orderId='20000000-0000-4000-8000-000000000001',token='a'.repeat(64)
const request=()=>({checkoutId:id,checkoutToken:token,amount:6875,customer:{email:' Buyer+tag@invalid.test ',name:'Buyer',address1:'123 Fixture Lane',address2:'',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}],discountCode:'WELCOME5',howHeard:'Customer'})
const priced={lines:[{productId:'1',name:'Catalog Product',quantity:10,unitPrice:500}],subtotalCents:5000,discountCents:500,discountSource:'loyalty',discountCode:'WELCOME5',shippingCents:2000,taxCents:375,taxCalculationId:'taxcalc_fixture',totalCents:6875}
function fixture(){
 const rows=new Map(),calls=[],intents=new Map();let chargeCount=0
 const db={from:table=>({select(){return this},eq(_key,value){this.key=value;return this},maybeSingle:async function(){assert.equal(table,'checkout_requests');return {data:rows.get(this.key)||null}}}),rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==='prepare_secure_checkout'){
   if(!rows.has(args.p_id))rows.set(args.p_id,{id:args.p_id,capability_hash:args.p_capability_hash,fingerprint:args.p_fingerprint,order_id:orderId,order_snapshot:args.p_order,intent_params:{...args.p_params,metadata:{...args.p_params.metadata,order_id:orderId}},created_at:new Date().toISOString(),intent_id:null})
   return {data:rows.get(args.p_id)}
  }
  if(name==='attach_secure_checkout'){rows.get(args.p_id).intent_id=args.p_intent;return {}}
  if(name==='apply_verified_order_payment')return {data:{status:args.p_succeeded?'paid':'failed'}}
  if(name==='claim_order_tax')return {data:null}
  return {}
 }}
 const stripe={paymentIntents:{create:async(params,{idempotencyKey})=>{calls.push({name:'stripe.create',params,idempotencyKey});if(!intents.has(idempotencyKey)){chargeCount++;intents.set(idempotencyKey,{id:'pi_fixture',livemode:true,client_secret:'pi_fixture_secret_private',status:'requires_payment_method',...params})}return intents.get(idempotencyKey)},retrieve:async()=>[...intents.values()][0]}}
 return {db,stripe,rows,calls,get chargeCount(){return chargeCount}}
}
test('intake normalizes exact email, strips trusted client fields and combines duplicate products',()=>{
 const raw=request();raw.customer.payment_status='paid';raw.items.push({productId:'1',quantity:5,price:1,name:'Forged Product'});raw.total_cents=1
 const normalized=normalizeCheckoutInput(raw)
 assert.equal(normalized.customer.email,'buyer+tag@invalid.test');assert.deepEqual(normalized.items,[{productId:'1',quantity:15}]);assert.ok(!JSON.stringify(normalized).includes('paid'));assert.ok(!JSON.stringify(normalized).includes('Forged'))
 for(const patch of [{items:[]},{items:[{productId:'1',quantity:-1}]},{customer:{...raw.customer,country:'CA'}},{customer:{...raw.customer,state:'ON'}},{customer:{...raw.customer,email:'invalid'}}])assert.throws(()=>normalizeCheckoutInput({...raw,...patch}))
 assert.throws(()=>checkoutIdentity({...raw,checkoutToken:'wrong'}));assert.throws(()=>checkoutIdentity({...raw,amount:1.5}))
})
test('actual creation uses trusted totals/catalog fields and recovers the same intent after a lost response',async()=>{
 const f=fixture();let pricedCalls=0;const price=async()=>{pricedCalls++;return priced}
 const first=await createSecurePayment(f.db,f.stripe,request(),price)
 assert.equal(first.status,200);assert.equal(first.body.orderId,orderId)
 const snapshot=f.rows.get(id);assert.equal(snapshot.order_snapshot.total_cents,6875);assert.equal(snapshot.order_snapshot.items[0].name,'Catalog Product');assert.equal(snapshot.order_snapshot.email,'buyer+tag@invalid.test')
 assert.equal(snapshot.intent_params.receipt_email,'buyer+tag@invalid.test');assert.ok(!JSON.stringify(snapshot).includes(token),'raw retry capability never stored')
 await createSecurePayment(f.db,f.stripe,request(),async()=>assert.fail('retry must use frozen snapshot'))
 assert.equal(f.chargeCount,1);assert.equal(pricedCalls,1)
 await assert.rejects(()=>createSecurePayment(f.db,f.stripe,{...request(),checkoutToken:'b'.repeat(64)},price),/capability/)
 await assert.rejects(()=>createSecurePayment(f.db,f.stripe,{...request(),amount:1},price),/details/)
 assert.equal(f.chargeCount,1)
})
test('concurrent same-capability requests use one provider idempotency identity and one logical payment',async()=>{
 const f=fixture();await Promise.all([createSecurePayment(f.db,f.stripe,request(),async()=>priced),createSecurePayment(f.db,f.stripe,request(),async()=>priced)])
 assert.equal(f.rows.size,1);assert.equal(f.chargeCount,1)
 const keys=f.calls.filter(c=>c.name==='stripe.create').map(c=>c.idempotencyKey);assert.ok(keys.every(key=>key===`secure-checkout/${id}`))
})
test('client total mismatch cannot create an order or payment',async()=>{
 const f=fixture();const result=await createSecurePayment(f.db,f.stripe,{...request(),amount:1},async()=>priced)
 assert.equal(result.status,409);assert.equal(f.rows.size,0);assert.equal(f.chargeCount,0)
})
test('uncertain old creation cannot recreate a charge after provider idempotency retention',async()=>{
 const f=fixture();await createSecurePayment(f.db,f.stripe,request(),async()=>priced);const row=f.rows.get(id);row.intent_id=null;row.created_at=new Date(Date.now()-24*3600000).toISOString()
 await assert.rejects(()=>createSecurePayment(f.db,f.stripe,request(),async()=>priced),/owner verification/);assert.equal(f.chargeCount,1)
})
test('wrong Stripe metadata, currency or receipt binding cannot return a capability',async()=>{
 for(const patch of [{currency:'cad'},{receipt_email:'other@invalid.test'},{metadata:{order_id:'other',secure_checkout_id:id}}]){
  const f=fixture();await createSecurePayment(f.db,f.stripe,request(),async()=>priced);
  f.stripe.paymentIntents.retrieve=async()=>({id:'pi_fixture',amount:6875,currency:'usd',receipt_email:'buyer+tag@invalid.test',metadata:{order_id:orderId,secure_checkout_id:id},...patch})
  await assert.rejects(()=>createSecurePayment(f.db,f.stripe,request(),async()=>priced),/binding/)
 }
})
const paidIntent=()=>({id:'pi_fixture',livemode:true,currency:'usd',amount:6875,amount_received:6875,status:'succeeded',receipt_email:'buyer@invalid.test',metadata:{order_id:orderId,secure_checkout_id:id,items:'[{"productId":"1","quantity":10}]'},latest_charge:{paid:true}})
test('server reconciliation verifies captured charge before any order write',async()=>{
 const f=fixture();for(const patch of [{amount_received:1},{latest_charge:null},{latest_charge:'ch_unexpanded'},{latest_charge:{paid:false}}])await assert.rejects(()=>reconcileOrderPayment(f.db,{}, {...paidIntent(),...patch}),/verified/)
 assert.equal(f.calls.length,0)
 await reconcileOrderPayment(f.db,{},paidIntent());assert.equal(f.calls[0].name,'apply_verified_order_payment');assert.equal(f.calls[0].args.p_checkout,id)
})
test('tax claim and provider identity are shared by webhook and confirmation; uncertainty is held',async()=>{
 const calls=[];let claimed=false
 const db={rpc:async(name,args)=>{calls.push({name,args});if(name==='claim_order_tax'){if(claimed)return {data:null};claimed=true;return {data:{calculation_id:'taxcalc',reference:orderId}}}return {data:{status:'paid'}}}}
 let sent=0;const stripe={tax:{transactions:{createFromCalculation:async(params,options)=>{sent++;assert.equal(options.idempotencyKey,`order-tax/${orderId}`);throw Error('uncertain')}}}}
 await Promise.all([reconcileOrderPayment(db,stripe,paidIntent()),reconcileOrderPayment(db,stripe,paidIntent())]);assert.equal(sent,1)
 assert.equal(calls.find(x=>x.name==='record_order_tax').args.p_transaction,null)
})
test('browser checkout and confirmation never directly access orders',()=>{
 for(const path of ['src/pages/CheckoutPage.jsx','src/pages/OrderSuccessPage.jsx'])assert.doesNotMatch(readFileSync(path,'utf8'),/\.from\(['"]orders['"]\)/)
})
test('browser retry identity survives reload without storing customer details and clears only after payment',async()=>{
 const values=new Map(),browser={sessionStorage:{setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)}}
 const first=await getOrCreateCheckoutDraft('private customer address',browser);delete browser.__checkoutDraft
 const second=await getOrCreateCheckoutDraft('private customer address',browser);assert.equal(first.id,second.id);assert.equal(first.token,second.token)
 assert.ok(![...values.values()].join('').includes('private customer address'))
 rememberCheckoutPayment(orderId,'pi_fixture_secret_private',browser,[]);clearPurchasedCart(orderId,[],()=>{},browser)
 delete browser.__checkoutDraft;delete browser.__checkoutPayment
 const saved=JSON.parse(values.get('ktodd-checkout-payment'));browser.__checkoutPayment=saved
 clearPurchasedCart(orderId,[],()=>{},browser)
 const third=await getOrCreateCheckoutDraft('private customer address',browser);assert.notEqual(third.id,first.id)
})

test('large secure baskets do not overflow Stripe metadata or require a legacy item string',async()=>{
 const f=fixture(),input=request();input.items=Array.from({length:30},(_,i)=>({productId:'fixture-long-product-'+i,quantity:10}))
 const result=await createSecurePayment(f.db,f.stripe,input,async()=>priced)
 assert.equal(result.status,200);assert.equal(f.rows.get(id).intent_params.metadata.items,undefined)
})

test('non-live or missing payment mode cannot bind a checkout or mutate order/stock/tax state',async()=>{
 for(const mode of [false,undefined]){
  const f=fixture(),original=f.stripe.paymentIntents.create
  f.stripe.paymentIntents.create=async(...args)=>({...await original(...args),livemode:mode})
  await assert.rejects(()=>createSecurePayment(f.db,f.stripe,request(),async()=>priced),/binding/)
  assert.ok(!f.calls.some(call=>call.name==='attach_secure_checkout'))
  await assert.rejects(()=>reconcileOrderPayment(f.db,f.stripe,{...paidIntent(),livemode:mode}),/mode requires review/)
  assert.ok(!f.calls.some(call=>call.name==='apply_verified_order_payment'||call.name==='claim_order_tax'))
 }
})


test('stacked coupon survives the trusted order snapshot for single-use redemption',async()=>{
 const f=fixture()
 await createSecurePayment(f.db,f.stripe,request(),async()=>({...priced,discountSource:'combined',baseDiscountSource:'combined'}))
 const order=f.rows.get(id).order_snapshot
 assert.equal(order.discount_code,'WELCOME5')
 assert.equal(order.discount_source,'combined')
 assert.match(order.discount_reason,/Loyalty discount plus discount code WELCOME5/)
})
