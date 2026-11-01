import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to service_role;create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
create table admin_users(id uuid,is_active boolean);insert into admin_users values('10000000-0000-4000-8000-000000000001',true),('10000000-0000-4000-8000-000000000002',false);`)
await db.exec('create table public.orders(id text primary key,email text);create table public.cart_abandonments(id text primary key,email text);create table public.newsletter_subscribers(id text primary key,email text);')
await db.exec(await fs.readFile('supabase/migrations/20261101030000_email_health.sql','utf8'))
for(const actor of ['', '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003']){
 await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[actor]);await db.exec('set role authenticated');await assert.rejects(()=>db.query('select get_email_health()'),/Active admin/)
}
await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select get_email_health()'),/permission denied/)
await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",['10000000-0000-4000-8000-000000000001']);await db.exec('set role authenticated')
assert.equal((await db.query('select get_email_health() h')).rows[0].h.emails.length,0)
await assert.rejects(()=>db.query('select * from email_attempts'),/permission denied/)
await assert.rejects(()=>db.query("insert into automation_runs(automation) values('fake')"),/permission denied/)
await db.exec(`reset role;insert into email_attempts(automation,entity_id,dedupe_key,status,provider_id) values('send-tracking-email-v2','order1','unique','accepted','provider-1');`)
await assert.rejects(()=>db.query("insert into email_attempts(automation,entity_id,dedupe_key) values('test','r','unique')"),/unique/)
await db.exec('set role authenticated')
assert.equal((await db.query("select get_email_health('order1') h")).rows[0].h.emails[0].provider_id,'provider-1')
assert.equal((await db.query("select get_email_health('order2') h")).rows[0].h.emails.length,0)
await db.exec('reset role;set role service_role')
await db.query("insert into automation_runs(automation) values('service-write')")
await db.query("update email_attempts set reason='verified' where dedupe_key='unique'")
assert.equal((await db.query('select count(*)::int n from email_attempts')).rows[0].n,1)
await assert.rejects(()=>db.query('delete from email_attempts'),/permission denied/)
await assert.rejects(()=>db.query('truncate email_attempts cascade'),/permission denied/)
await db.exec('reset role;set role authenticated')
for(const table of ['email_attempts','automation_runs']) {
 await assert.rejects(()=>db.query(`select * from ${table}`),/permission denied/)
 await assert.rejects(()=>db.query(`update ${table} set status='pending'`),/permission denied/)
 await assert.rejects(()=>db.query(`delete from ${table}`),/permission denied/)
}
await db.exec('reset role')
for (const [table,automation,view] of [['newsletter_subscribers','send-welcome-series','welcome'],['cart_abandonments','send-abandoned-cart','recovery'],['orders','send-reorder-reminder','reorder']]) {
 await db.exec(`insert into ${table}(id,email) select 'batch-'||lpad(i::text,3,'0'),'fixture-'||i||'@invalid.test' from generate_series(1,60)i; insert into email_attempts(automation,entity_id,dedupe_key,status) select '${automation}','batch-'||lpad(i::text,3,'0'),'${automation}-'||i,case when i%3=0 then 'pending' when i%3=1 then 'uncertain' else 'rejected' end from generate_series(1,50)i;`)
 const legacy=(await db.query(`select id from ${table} where id like 'batch-%' order by id limit 50`)).rows
 assert.equal(legacy.length,50);assert.ok(legacy.every(r=>Number(r.id.slice(6))<=50),'reproduces old full blocked batch')
 await db.exec('set role service_role')
 const available=(await db.query(`select id from email_candidates_${view} where id like 'batch-%' order by id limit 50`)).rows
 assert.equal(available.length,10);assert.ok(available.every(r=>Number(r.id.slice(6))>50),'only new candidates pass')
 await db.exec('reset role;set role authenticated');await assert.rejects(()=>db.query(`select * from email_candidates_${view}`),/permission denied/);await db.exec('reset role')
}
await db.exec("insert into orders values('newer','same@invalid.test'),('older','same@invalid.test');insert into email_attempts(automation,entity_id,dedupe_key,status) values('send-winback','newer','winback-held','uncertain');set role service_role")
assert.equal((await db.query("select count(*)::int n from email_candidates_winback where email='same@invalid.test'")).rows[0].n,0,'older order cannot bypass held winback recipient')
await db.exec('reset role;set role authenticated');await assert.rejects(()=>db.query('select * from email_candidates_winback'),/permission denied/)
await db.close();console.log('PASS isolated SQL: migration, unique claim, active admin isolation, anon/inactive rejection, no direct writes, persisted filtered history')
