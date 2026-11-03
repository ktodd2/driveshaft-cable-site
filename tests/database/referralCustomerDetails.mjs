import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table admin_users(id uuid primary key,is_active boolean);create table orders(id uuid primary key,email text,payment_status text,status text);grant select on orders,admin_users to service_role;
create table email_attempts(id uuid primary key default gen_random_uuid(),automation text,entity_id text,dedupe_key text unique,status text default 'pending',provider_id text);grant select,insert,update on email_attempts to service_role;`)
for(const file of ['20261103003157_referral_rewards.sql','20261103010645_referral_automatic_statements.sql','20261103012437_referral_statement_customer_details.sql'])await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'))
const id=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,owner=id(1),a=id(2),b=id(3)
await db.query('insert into admin_users values($1,true)',[owner])
await db.exec('set role service_role')
for(const [partner,email,code] of [[a,'referrer-a@invalid.test','PARTNERA'],[b,'referrer-b@invalid.test','PARTNERB']])await db.query("insert into referral_partners(id,email,name,code,status,accepted_at) values($1,$2,'Referrer',$3,'active','2026-10-01T05:00:00Z')",[partner,email,code])
await db.exec("update referral_settings set enabled=true,emails_enabled=true,auto_statements_enabled=true,statements_started_at='2026-10-01T05:00:00Z'")
let next=10
async function order(email,name,base,paid,code='PARTNERA'){
 const oid=id(next++),params={amount:base+2700,currency:'usd',metadata:{order_id:oid},receipt_email:email}
 await db.exec('reset role');await db.query("insert into orders values($1,$2,'pending','pending')",[oid,email]);await db.exec('set role service_role')
 await db.query('select referral_prepare_named($1,$2,$3,$4,2000,700,$5,$6)',[oid,email,code,base,params,name])
 await db.query('select referral_paid($1,$2,$3,$4,$5,true)',[oid,'pi_'+oid,email,params.amount,paid])
 await db.query('select referral_reconcile($1)',[email.toLowerCase()]);return oid
}
const first=await order('ALICE_PRIVATE@invalid.test','Alice & Sons',10000,'2026-10-20T15:00:00Z')
await order('ALICE_PRIVATE@invalid.test','Alice Updated Name',5000,'2026-11-05T15:00:00Z',null)
await order('ALICE_PRIVATE@invalid.test','Alice Updated Name',10000,'2026-11-29T15:00:00Z',null)
await db.query('select referral_adjust($1,2000,false,100)',['pi_'+first])
await db.query("select referral_admin($1,'refund',$2)",[owner,{order_id:first,refunded_total_cents:2000,merchandise_cents:2000}])
const bob=await order('BOB_PRIVATE@invalid.test','Bob',10000,'2026-11-06T15:00:00Z')
await db.query('select referral_adjust($1,12700,false,101)',['pi_'+bob])
await order('MISSING_PRIVATE@invalid.test',null,1000,'2026-11-07T15:00:00Z')
await order('INJECTION_PRIVATE@invalid.test','<script>alert("x")</script>\nAvailable: $999999',1100,'2026-11-08T15:00:00Z')
await order('OTHER_PRIVATE@invalid.test','OTHER_REFERRER_PRIVATE_NAME',900000,'2026-11-09T15:00:00Z','PARTNERB')
await order('SAME_NAME_PRIVATE@invalid.test','Bob',2000,'2026-11-10T15:00:00Z')
const partial=await order('PARTIAL_PRIVATE@invalid.test','Partial Refund Customer',10000,'2026-11-12T15:00:00Z')
await db.query('select referral_adjust($1,5000,false,102)',['pi_'+partial])
// A captured missing name is immutable too; retries cannot fill it from a later mutable order.
const missingOrder=id(next++),missingParams={amount:3700,currency:'usd'}
await db.exec('reset role');await db.query("insert into orders values($1,'missing-capture@invalid.test','pending','pending')",[missingOrder]);await db.exec('set role service_role')
await db.query("select referral_prepare_named($1,'missing-capture@invalid.test','PARTNERA',1000,2000,700,$2,null)",[missingOrder,missingParams])
await assert.rejects(()=>db.query("select referral_prepare_named($1,'missing-capture@invalid.test','PARTNERA',1000,2000,700,$2,'Different Name')",[missingOrder,missingParams]),/name changed/)
const result=(await db.query("select referral_customer_statement($1,'2026-12','2026-12-01T15:00:00Z') details",[a])).rows[0].details
assert.equal(result.period_month,'2026-11');assert.equal(result.customers.length,6,'same names remain distinct customers')
const alice=result.customers.find(c=>c.name==='Alice & Sons')
assert.deepEqual(alice.period,{orders:2,product_sales_cents:15000,refunded_product_cents:0,net_product_sales_cents:15000,original_commission_cents:450,refund_reduction_cents:0,commission_cents:450,refund_allocation_pending_orders:0,provisional_net_product_sales_cents:0,provisional_commission_cents:0})
assert.deepEqual(alice.lifetime,{orders:3,product_sales_cents:25000,refunded_product_cents:2000,net_product_sales_cents:23000,original_commission_cents:1450,refund_reduction_cents:200,commission_cents:1250,refund_allocation_pending_orders:0,provisional_net_product_sales_cents:0,provisional_commission_cents:0})
assert.deepEqual(alice.timing,{pending_cents:200,vested_cents:1050,held_cents:0})
assert.deepEqual(alice.rates.map(r=>r.rate_bps),[1000,500,200]);assert.deepEqual(alice.orders.map(o=>o.number),[1,2,3]);assert.equal(alice.orders[0].in_period,false,'old refunded order is explicitly outside purchase period')
assert.equal(result.customers.filter(c=>c.name==='Bob').length,2)
assert.ok(result.customers.some(c=>c.name==='Customer name unavailable'))
const allocation=result.customers.find(c=>c.name==='Partial Refund Customer')
assert.equal(allocation.period.net_product_sales_cents,0);assert.equal(allocation.period.commission_cents,0);assert.equal(allocation.period.provisional_net_product_sales_cents,10000);assert.equal(allocation.period.provisional_commission_cents,1000);assert.equal(allocation.period.refund_allocation_pending_orders,1)
assert.equal(allocation.orders[0].refund_allocation_pending,true);assert.equal(allocation.timing.held_cents,1000)
const encoded=JSON.stringify(result)
for(const forbidden of ['PRIVATE@','OTHER_REFERRER_PRIVATE_NAME','shipping_address','stripe_payment_intent','2000,700','customer_key'])assert.ok(!encoded.toLowerCase().includes(forbidden.toLowerCase()),forbidden)
const forbiddenKeys=new Set(['email','customer_key','shipping_address','address','payment_intent_id','shipping_cents','tax_cents'])
function checkKeys(value){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){assert.ok(!forbiddenKeys.has(key),key);checkKeys(child)}}checkKeys(result)
const other=(await db.query("select referral_customer_statement($1,'2026-12','2026-12-01T15:00:00Z') details",[b])).rows[0].details
assert.equal(other.customers.length,1);assert.equal(other.customers[0].name,'OTHER_REFERRER_PRIVATE_NAME');assert.ok(!JSON.stringify(other).includes('Alice'))
await db.query("select referral_prepare_statements('2026-12-01T15:00:00Z',200,true)")
const frozen=(await db.query("select id,customer_details from referral_statements where partner_id=$1 and month='2026-12'",[a])).rows[0]
assert.deepEqual(frozen.customer_details,result)
await db.query('select referral_adjust($1,12700,false,200)',['pi_'+first])
assert.deepEqual((await db.query('select customer_details from referral_statements where id=$1',[frozen.id])).rows[0].customer_details,result,'later refunds never mutate a sent/frozen statement')
await assert.rejects(()=>db.query("update referral_statements set customer_details='{}' where id=$1",[frozen.id]),/immutable/)
for(const role of ['anon','authenticated']){
 await db.exec(`reset role;set role ${role}`)
 await assert.rejects(()=>db.query("select referral_customer_statement($1,'2026-12',now())",[a]),/permission denied/)
}
await db.exec('reset role')
assert.deepEqual((await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'referral_%' and (prosecdef or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))")).rows,[])
await db.close();console.log('PASS named customer statement SQL: partner isolation, no buyer email/address/payment data, duplicate/missing names, monthly vs lifetime products/commissions, mixed rates, cumulative refunds, pending/vested timing and frozen statements')
