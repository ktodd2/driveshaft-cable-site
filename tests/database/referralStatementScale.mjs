// Illustrative local fixture only: no hosted DB or email provider is used.
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {statementText} from '../../supabase/functions/_shared/referrals.js'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table admin_users(id uuid primary key,is_active boolean);create table orders(id uuid primary key,email text,payment_status text,status text);grant select on orders,admin_users to service_role;
create table email_attempts(id uuid primary key default gen_random_uuid(),automation text,entity_id text,dedupe_key text unique,status text default 'pending',provider_id text);grant select,insert,update on email_attempts to service_role;`)
for(const file of ['20261103003157_referral_rewards.sql','20261103010645_referral_automatic_statements.sql','20261103012437_referral_statement_customer_details.sql','20261103013111_referral_code_choices.sql'])await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'))
const partner='60000000-0000-4000-8000-000000000001'
await db.query("insert into referral_partners(id,email,name,code,status,accepted_at) values($1,'load-referrer@invalid.test','Load Referrer','LOAD100','active','2026-10-01T05:00:00Z')",[partner])
await db.exec(`create temp table fixture_sales as select gen_random_uuid() oid,'load-buyer-'||n||'@invalid.test' email,'Load Customer '||n buyer_name,i sequence,'2026-11-01T15:00:00Z'::timestamptz+i*interval '1 day' paid_at,case when i=1 then 1000 when i=2 then 500 when i<=10 then 200 else 100 end rate from generate_series(1,100)n cross join generate_series(1,12)i;
insert into orders select oid,email,'paid','confirmed' from fixture_sales;
insert into referral_checkouts(order_id,email,partner_id,merchandise_cents,shipping_cents,tax_cents,total_cents,intent_params,intent_id,state,paid_at,paid_time_verified,buyer_name,buyer_name_captured) select oid,email,'${partner}',10000,2000,700,12700,'{}','pi_'||oid,'paid',paid_at,true,buyer_name,true from fixture_sales;
insert into referral_buyers(email,partner_id,first_order_id,next_sequence) select email,'${partner}',oid,13 from fixture_sales where sequence=1;
insert into referral_earnings(order_id,partner_id,email,sequence,rate_bps,base_cents,original_cents,paid_at,available_at) select oid,'${partner}',email,sequence,rate,10000,rate,paid_at,paid_at+interval '7 days' from fixture_sales;
set role service_role;`)
const started=performance.now()
const details=(await db.query("select referral_customer_statement($1,'2026-12','2026-12-01T15:00:00Z') details",[partner])).rows[0].details
const sqlMs=Math.round(performance.now()-started)
assert.equal(details.customers.length,100)
for(const customer of details.customers){assert.equal(customer.lifetime.orders,12);assert.equal(customer.lifetime.commission_cents,3300);assert.equal(customer.period.commission_cents,3300);assert.equal(customer.orders.length,12);assert.deepEqual(customer.rates.map(r=>r.rate_bps),[1000,500,200,100])}
const balance=(await db.query("select referral_balance($1,'2026-12-01T15:00:00Z') b",[partner])).rows[0].b
assert.equal(balance.available,330000)
const text=statementText({name:'Load Referrer',code:'LOAD100'},{month:'2026-12',created_at:'2026-12-01T15:00:00Z',balance,customer_details:details})
assert.ok(!text.includes('@invalid.test'));assert.ok(!text.includes('pi_'));assert.equal((text.match(/Customer \d+:/g)||[]).length,100)
const bytes=Buffer.byteLength(text)
await db.close();console.log(`PASS illustrative statement fixture: 100 named customers / 1,200 orders; mixed tiers and $3,300 total commissions reconcile; ${bytes} plaintext bytes; local SQL ${sqlMs}ms (not a hosted performance guarantee)`)
