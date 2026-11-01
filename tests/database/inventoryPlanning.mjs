// Isolated Postgres engine only. Never connects to Supabase or production.
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite }=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db=new PGlite()
const admin='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',inactive='10000000-0000-4000-8000-000000000003'
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
create table public.admin_users(id uuid primary key,is_active boolean);insert into admin_users values('${admin}',true),('${inactive}',false);
create table public.products(id text primary key);insert into products values('1'),('xl');
create table public.product_shipments(id uuid primary key,product_id text,quantity integer,total_cost_cents integer);
insert into product_shipments values('20000000-0000-4000-8000-000000000001','1',40,1000);
create table public.product_inventory(product_id text,stock_quantity integer);insert into product_inventory values('1',500);`)
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261101020000_inventory_planning.sql',import.meta.url),'utf8'))
const actor=async id=>{await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[id]);await db.exec('set role authenticated')}
const read=()=>db.query('select public.get_inventory_plan() as plan')
const line={id:'30000000-0000-4000-8000-000000000001',reference:'A',productId:'1',quantity:100,etaStart:'2026-12-01',etaEnd:'2026-12-16',receiptIds:['20000000-0000-4000-8000-000000000001']}
const doc={days:30,lead:'45',safety:'7',lines:[line]}
let sequence=1
const save=(d=doc,rev=0,id=`40000000-0000-4000-8000-${String(sequence++).padStart(12,'0')}`)=>db.query('select public.save_inventory_plan($1::uuid,$2::integer,$3::jsonb) as result',[id,rev,JSON.stringify(d)])
for(const id of ['',other,inactive]){await actor(id);await assert.rejects(read,/Active admin/);await assert.rejects(()=>save(),/Active admin/)}
await db.exec('reset role;set role anon');await assert.rejects(read,/permission denied/)
await actor(admin)
await assert.rejects(()=>db.query('select * from inventory_planning_state'),/permission denied/)
await assert.rejects(()=>db.query("update inventory_planning_state set revision=99"),/permission denied/)
assert.equal((await read()).rows[0].plan.revision,0)
const key='50000000-0000-4000-8000-000000000001'
assert.equal((await save(doc,0,key)).rows[0].result.revision,1)
assert.equal((await save(doc,0,key)).rows[0].result.status,'already_saved')
await assert.rejects(()=>save({...doc,lead:'30'},0,key),/reused/)
await assert.rejects(()=>save(doc,0),/another device/)
const invalid=[
 {...doc,lines:[line,{...line,id:'30000000-0000-4000-8000-000000000002',reference:' a '}]},
 {...doc,lines:[{...line,receiptIds:[...line.receiptIds,...line.receiptIds]}]},
 {...doc,lines:[{...line,quantity:30}]},
 {...doc,lines:[{...line,productId:'xl'}]},
 {...doc,lines:[{...line,receiptIds:['20000000-0000-4000-8000-000000000099']}]},
 {...doc,lines:[{...line,etaEnd:'2026-02-30'}]},
 {...doc,lines:[{...line,quantity:-1}]},
 {...doc,lines:[{...line,id:''}]},
 {...doc,lead:'731'}, {...doc,safety:null}, {...doc,lines:null}
]
for(const d of invalid){await assert.rejects(()=>save(d,1));assert.equal((await read()).rows[0].plan.revision,1)}
const next={...doc,lead:'40'}
assert.equal((await save(next,1)).rows[0].result.revision,2)
const retry=(await save(doc,0,key)).rows[0].result;assert.equal(retry.revision,1);assert.equal(retry.current_revision,2)
await db.exec('reset role')
assert.equal((await db.query('select stock_quantity from product_inventory')).rows[0].stock_quantity,500)
assert.equal((await db.query('select total_cost_cents from product_shipments')).rows[0].total_cost_cents,1000)
assert.equal((await db.query('select count(*)::int as n from inventory_planning_requests')).rows[0].n,2)
await db.close()
console.log('PASS isolated SQL: admin/anon/inactive permissions, direct table denial, atomic save, retries, stale revision, duplicate lines/receipts, partial receipt validation, dates, unchanged stock/costs')
