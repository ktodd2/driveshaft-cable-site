import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {createSecurePayment,normalizeCheckoutInput} from '../../supabase/functions/_shared/secureCheckout.js'
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
const request=(email,code)=>({checkoutId:crypto.randomUUID(),checkoutToken:token(),customer:{email,name:'Buyer',address1:'123 Fixture Lane',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}],referralCode:code})
test('direct checkout needs no CAPTCHA/email proof, retains pricing, capability and first-checkout protections',async()=>{
 const f=await commerceFixture({policyRuntime:true,emailVerification:true})
 try {
  await f.sql.exec('reset role')
  await f.sql.exec(await readFile(new URL('../../supabase/migrations/20261117180851_restore_direct_checkout.sql',import.meta.url),'utf8'))
  await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented)values('owner@invalid.test','Owner','paid','confirmed','cash','[]',100,true)")
  await f.sql.exec('set role service_role;update referral_settings set enabled=true,buyer_verification_emails_enabled=true')
  const p=await f.db.rpc('referral_create_partner',{p_actor:f.owner,p_email:'owner@invalid.test',p_name:'Owner',p_code:'DIRECT-CODE',p_generate:false});assert.ifError(p.error)
  await f.sql.query("update referral_partners set status='active' where id=$1",[p.data.id])
  const create=input=>createSecurePayment(f.db,f.stripe,input,f.price,{referralEnabled:true})
  for(const code of [null,'DIRECT-CODE']) {
   const input=request(code?'coded@invalid.test':'plain@invalid.test',code)
   const quote=await f.price(normalizeCheckoutInput(input));assert.equal(quote.verificationRequired,false)
   input.amount=quote.totalCents
   assert.equal((await create({...input,amount:1})).status,409)
   const made=await create(input);assert.equal(made.status,200)
   const retry=await create(input);assert.equal(retry.status,200);assert.deepEqual(retry.body,made.body)
   await assert.rejects(()=>create({...input,checkoutToken:token()}),/unavailable|token|capability|match/i)
   await assert.rejects(()=>create({...input,checkoutId:crypto.randomUUID(),checkoutToken:token()}),/unfinished first-order checkout/)
  }
  assert.equal((await f.sql.query('select count(*)::int n from buyer_verification_requests')).rows[0].n,0)
  assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,2)
 } finally {await f.sql.close()}
})
