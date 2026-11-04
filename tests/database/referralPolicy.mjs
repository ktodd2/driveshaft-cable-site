import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table admin_users(id uuid primary key,is_active boolean);create table orders(id uuid primary key,email text,payment_status text,status text);grant select on orders,admin_users to service_role;')
for(const name of ['20261103003157_referral_rewards.sql','20261103013111_referral_code_choices.sql','20261103143717_referral_code_policy.sql'])await db.exec(await fs.readFile('supabase/migrations/'+name,'utf8'))
const id=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`,owner=id(1),inactive=id(2)
await db.query('insert into admin_users values($1,true),($2,false)',[owner,inactive])
await db.query("insert into orders values($1,'owner@invalid.test','paid','confirmed'),($2,'other@invalid.test','paid','confirmed')",[id(3),id(4)])
await db.exec('set role service_role')
const create=async(email,code)=>(await db.query('select referral_create_partner($1,$2,$3,$4,false) result',[owner,email,'Fixture',code])).rows[0].result
const a=await create('owner@invalid.test','MANUAL-CODE'),b=await create('other@invalid.test','OTHER-CODE')
const read=async partner=>(await db.query('select * from referral_partners where id=$1',[partner])).rows[0]
const initial=await read(a.id)
assert.equal(initial.buyer_discount_bps,500);assert.equal(initial.commission_tiers.at(-1).through,20);assert.equal(initial.policy_revision,1)
const tiers=[{through:1,bps:1234},{through:4,bps:0},{through:20,bps:50}]
const save=async(partner=a.id,revision=1,discount=725,value=tiers,actor=owner)=>(await db.query('select referral_set_code_policy($1,$2,$3,$4,$5) result',[actor,partner,revision,discount,value])).rows[0].result
await assert.rejects(()=>save(a.id,1,725,tiers,inactive),/Active admin/)
for(const value of [null,{},[],[{through:1,bps:-1}],[{through:1,bps:1.2}],[{through:1,bps:10001}],[{through:1.5,bps:100}],[{through:1,bps:'500'}],[{through:2,bps:500},{through:2,bps:100}],[{through:1,bps:100,extra:1}]])await assert.rejects(()=>save(a.id,1,725,value),/increasing whole-order/)
for(const discount of [null,-1,10001])await assert.rejects(()=>save(a.id,1,discount),/discount/)
const saved=await save();assert.equal(saved.policy_revision,2);assert.equal(saved.buyer_discount_bps,725);assert.deepEqual(saved.commission_tiers,tiers)
assert.equal((await read(b.id)).buyer_discount_bps,500,'per-code isolation')
assert.equal((await save(a.id,2)).policy_revision,2,'identical save is idempotent')
await assert.rejects(()=>save(a.id,1,100),/settings changed/)
const race=await Promise.allSettled([save(a.id,2,100),save(a.id,2,200)])
assert.equal(race.filter(x=>x.status==='fulfilled').length,1,'one compare-and-swap winner; PGlite serializes calls, not proof of overlapping DB sessions')
assert.equal((await db.query('select count(*)::int n from referral_policy_versions where partner_id=$1',[a.id])).rows[0].n,3)
assert.equal((await db.query("select count(*)::int n from referral_audit where action='code_policy'")).rows[0].n,2)
await assert.rejects(()=>db.query('update referral_policy_versions set buyer_discount_bps=999'),/permission denied/)
await assert.rejects(()=>db.query('delete from referral_policy_versions'),/permission denied/)
for(const role of ['anon','authenticated']){
 await db.exec(`reset role;set role ${role}`)
 await assert.rejects(()=>save(a.id,3),/permission denied/)
 await assert.rejects(()=>db.query('select * from referral_policy_versions'),/permission denied/)
 await assert.rejects(()=>db.query('update referral_partners set buyer_discount_bps=10000'),/permission denied/)
}
await db.close();console.log('PASS per-code policy SQL: defaults, per-code settings, admin-only CAS, version/audit history, invalid shapes/rates, idempotent saves and denied browser mutation. Local serialized race only; hosted overlap remains required.')
