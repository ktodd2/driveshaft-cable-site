import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite(),owner='61000000-0000-4000-8000-000000000001',inactive='61000000-0000-4000-8000-000000000002'
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table admin_users(id uuid primary key,is_active boolean);
create table orders(id uuid primary key default gen_random_uuid(),email text,name text,company text,payment_status text,status text,payment_method text,created_at timestamptz default now());grant select on orders,admin_users to service_role;`)
for(const file of ['20261103003157_referral_rewards.sql','20261103013111_referral_code_choices.sql','20261104042526_referral_past_customer_search.sql'])await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'))
await db.query('insert into admin_users values($1,true),($2,false)',[owner,inactive])
await db.exec(`insert into orders(email,name,payment_status,status,payment_method,created_at)
select 'buyer'||lpad(n::text,4,'0')||'@customer-fixture.com','Customer '||n,'paid','confirmed','stripe','2026-01-01'::timestamptz from generate_series(1,1005) n;`)
const valid=[
 ['refunded@customer-fixture.com','Refunded Customer',null,'refunded','cancelled','stripe'],
 ['partial@customer-fixture.com','Partially Refunded',null,'partially_refunded','confirmed','stripe'],
 ['company@customer-fixture.com','', 'Company Only','paid','confirmed','manual'],
 ['missing@customer-fixture.com',null,null,'paid','confirmed','stripe'],
 ['percent@customer-fixture.com','100% Real_Name',null,'paid','confirmed','stripe'],
 ['markup@customer-fixture.com','<script>fixture()</script>',null,'paid','confirmed','stripe'],
]
const invalid=[
 ['fake@qa.invalid','Fake',null,'paid','confirmed','stripe'],['fake@qa.test','Fake',null,'paid','confirmed','stripe'],
 ['fake@example.com','Fake',null,'paid','confirmed','stripe'],['fake@sub.example.org','Fake',null,'paid','confirmed','stripe'],
 ['fake@test.example','Fake',null,'paid','confirmed','stripe'],['unpaid@customer-fixture.com','Unpaid',null,'pending','pending','stripe'],
 ['test@customer-fixture.com','Test',null,'paid','test','stripe'],['synthetic@customer-fixture.com','Synthetic',null,'paid','synthetic','stripe'],
 ['method@customer-fixture.com','Method',null,'paid','confirmed','stripe_test'],['not-an-email','Bad',null,'paid','confirmed','stripe'],
]
for(const row of [...valid,...invalid])await db.query('insert into orders(email,name,company,payment_status,status,payment_method) values($1,$2,$3,$4,$5,$6)',row)
await db.query("insert into orders(email,name,payment_status,status,payment_method,created_at) values(' BUYER0001@CUSTOMER-FIXTURE.COM ','Latest Customer','paid','confirmed','stripe','2026-02-01')")
await db.exec('set role service_role')
const search=async(query='',after=null,limit=25,actor=owner)=>(await db.query('select referral_past_customer_search($1,$2,$3,$4) result',[actor,query,after,limit])).rows[0].result
const all=[];let cursor=null,pages=0
for(;;){const result=await search('',cursor,17);assert.ok(result.customers.length<=17);all.push(...result.customers);pages++;if(!result.nextCursor)break;assert.ok(result.nextCursor!==cursor);cursor=result.nextCursor;assert.ok(pages<100)}
assert.equal(all.length,1005+valid.length,'every eligible customer is reachable beyond the first 1000')
assert.equal(new Set(all.map(x=>x.email)).size,all.length,'normalized email collision appears once')
assert.deepEqual(all.map(x=>x.email),all.map(x=>x.email).sort())
for(const row of all)assert.deepEqual(Object.keys(row).sort(),['email','name'],'no address, phone, orders or financial data in results')
assert.equal((await search('LATEST CUSTOMER')).customers[0].email,'buyer0001@customer-fixture.com')
assert.equal((await search('COMPANY ONLY')).customers[0].name,'Company Only')
assert.equal((await search('missing@')).customers[0].name,'','missing name is not replaced by email')
assert.equal((await search('%')).customers.length,1,'percent is literal, not a SQL wildcard')
assert.equal((await search('Real_Name')).customers.length,1,'underscore is literal')
assert.equal((await search("' OR true --")).customers.length,0,'untrusted search never becomes SQL')
assert.ok((await search('refunded@')).customers.length===1,'previously paid refunded-only customer is retained')
for(const actor of [null,inactive,'61000000-0000-4000-8000-000000000099'])await assert.rejects(()=>search('',null,25,actor),/Active admin/)
for(const size of [0,51,null])await assert.rejects(()=>search('',null,size),/Invalid customer search/)
await assert.rejects(()=>search('x'.repeat(255)),/Invalid customer search/)
const created=(await db.query('select referral_create_partner($1,$2,$3,$4,false) result',[owner,'refunded@customer-fixture.com','Refunded Customer','REFUNDED-CODE'])).rows[0].result
assert.equal(created.code,'REFUNDED-CODE')
await assert.rejects(()=>db.query('select referral_create_partner($1,$2,$3,$4,false)',[owner,'fake@qa.invalid','Fake','BAD-CODE']),/existing paid customer/)
for(const role of ['anon','authenticated']){
 await db.exec(`reset role;set role ${role}`)
 await assert.rejects(()=>search(),/permission denied/)
 await assert.rejects(()=>db.query("select referral_eligible_past_order('x@customer-fixture.com','paid','confirmed','stripe')"),/permission denied/)
}
await db.close();console.log('PASS actual SQL: 1011 customers paginated beyond1000, normalized dedupe, names/email literal search, refunds, test exclusion, minimal fields, strict active-admin/service-only authority and matching creation eligibility')
