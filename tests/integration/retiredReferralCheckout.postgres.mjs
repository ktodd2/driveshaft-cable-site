import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {createSecurePayment,normalizeCheckoutInput,reconcileOrderPayment} from '../../supabase/functions/_shared/secureCheckout.js'
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
const request=email=>({checkoutId:crypto.randomUUID(),checkoutToken:token(),customer:{email,name:'Buyer',address1:'123 Fixture Lane',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}]})
test('retirement permits legacy email and independent checkouts, preserves same-request safety and history',async()=>{
 const f=await commerceFixture({policyRuntime:true,emailVerification:true,referralEnabled:false})
 try {
  await f.sql.exec('reset role')
  const legacy=(await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented)values('legacy@invalid.test','Legacy','pending','pending','stripe','[]',17370,false) returning *")).rows[0]
  await f.sql.exec(await readFile(new URL('../../supabase/migrations/20261117191428_retire_referral_program.sql',import.meta.url),'utf8'))
  await f.sql.exec('set role service_role')
  const create=input=>createSecurePayment(f.db,f.stripe,input,f.price,{referralEnabled:false})
  const input=request('legacy@invalid.test');const quote=await f.price(normalizeCheckoutInput(input));input.amount=quote.totalCents
  assert.equal(quote.verificationRequired,false);assert.equal(quote.referralDiscountCents,0)
  assert.equal((await create({...input,amount:1})).status,409)
  const [a,b]=await Promise.all([create(input),create(input)]);assert.equal(a.status,200);assert.deepEqual(a.body,b.body);assert.equal(f.intents.size,1)
  await assert.rejects(()=>create({...input,checkoutToken:token()}),/capability|changed/)
  const other={...input,checkoutId:crypto.randomUUID(),checkoutToken:token()};assert.equal((await create(other)).status,200);assert.equal(f.intents.size,2)
  assert.equal((await create({...input,checkoutId:crypto.randomUUID(),referralCode:'OLD-CODE'})).status,409)
  assert.deepEqual((await f.sql.query('select * from orders where id=$1',[legacy.id])).rows[0],legacy)
  for(const table of ['referral_first_checkouts','referral_checkouts','referral_earnings','buyer_verification_requests'])assert.equal((await f.sql.query(`select count(*)::int n from ${table}`)).rows[0].n,0)
  const intent=[...f.intents.values()][0];assert.equal(intent.metadata.referral_system,undefined)
  f.succeed(intent.id);const paid=f.intents.get(intent.id)
  await assert.rejects(()=>reconcileOrderPayment(f.db,f.stripe,{...paid,amount:paid.amount+1}),/verified|storage|binding/i)
  await reconcileOrderPayment(f.db,f.stripe,paid);await reconcileOrderPayment(f.db,f.stripe,paid)
  assert.equal((await f.sql.query('select count(*)::int n from order_payment_receipts')).rows[0].n,1)
  assert.equal((await f.sql.query("select stock_quantity from product_inventory where product_id='1'")).rows[0].stock_quantity,99990)
  await f.sql.exec('reset role;set role anon');await assert.rejects(()=>f.sql.query('select * from checkout_requests'),/permission denied/)
 } finally {await f.sql.close()}
})

test('actual deployed checkout entrypoints ignore stale enabled flags and create no new referral records',async()=>{
 const {runInNewContext}=await import('node:vm'),{stripTypeScriptTypes}=await import('node:module')
 const {checkoutErrorMessage}=await import('../../supabase/functions/_shared/secureCheckout.js')
 const f=await commerceFixture({policyRuntime:true,emailVerification:true,referralEnabled:false})
 try{
  await f.sql.exec('reset role');await f.sql.exec(await readFile(new URL('../../supabase/migrations/20261117191428_retire_referral_program.sql',import.meta.url),'utf8'));await f.sql.exec('set role service_role')
  for(const name of ['create-secure-checkout','create-payment-intent']){
   let handler;class Stripe{constructor(){return f.stripe}}
   const source=(await readFile(`supabase/functions/${name}/index.ts`,'utf8')).replace(/^import .*\n/gm,'')
   runInNewContext(stripTypeScriptTypes(source),{serve:fn=>handler=fn,Stripe,createAdminClient:()=>f.db,createSecurePayment,checkoutErrorMessage,priceCheckout:(_db,_stripe,input,options)=>{assert.equal(options.referralEnabled,false);assert.equal(options.buyerVerificationEnabled,false);return f.price(input)},createPurchaseSnapshot:()=>null,analyticsMetadata:()=>({}),Deno:{env:{get:()=> 'true'}},Response,JSON,Error})
   const input=request(name+'@invalid.test');input.amount=(await f.price(normalizeCheckoutInput(input))).totalCents
   const response=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify(input)}));assert.equal(response.status,200)
  }
  assert.equal((await f.sql.query('select count(*)::int n from referral_checkouts')).rows[0].n,0)
 } finally {await f.sql.close()}
})
