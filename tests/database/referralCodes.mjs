import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table admin_users(id uuid primary key,is_active boolean);create table orders(id uuid primary key,email text,payment_status text,status text);grant select on orders,admin_users to service_role;`)
for(const file of ['20261103003157_referral_rewards.sql','20261103013111_referral_code_choices.sql'])await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'))
const id=n=>`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`,owner=id(1),inactive=id(2)
await db.query('insert into admin_users values($1,true),($2,false)',[owner,inactive])
for(let n=1;n<=12;n++)await db.query("insert into orders values($1,$2,'paid','confirmed')",[id(n+20),`customer${n}@invalid.test`])
await db.exec('set role service_role')
const create=async(n,code,generated=false,actor=owner)=>(await db.query('select referral_create_partner($1,$2,$3,$4,$5) result',[actor,`customer${n}@invalid.test`,'Fixture Customer',code,generated])).rows[0].result
await assert.rejects(()=>create(1,'CODE',false,inactive),/Active admin/)
await assert.rejects(()=>create(1,'ab'),/3–24/)
await assert.rejects(()=>create(1,'A BAD CODE'),/3–24/)
await assert.rejects(()=>create(1,'-ABC'),/3–24/)
await assert.rejects(()=>create(1,'ABC-'),/3–24/)
const custom=await create(1,' ktodd-shop ');assert.equal(custom.code,'KTODD-SHOP')
await assert.rejects(()=>create(2,'KtOdD-sHoP'),/already in use/)
await assert.rejects(()=>create(1,'NEW-CODE'),/already has a referral code/)
const generated=await create(2,null,true);assert.match(generated.code,/^DC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
const collision=await create(3,generated.code.toLowerCase(),true);assert.notEqual(collision.code,generated.code);assert.match(collision.code,/^DC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
const race=await Promise.allSettled([create(4,'SAME-CODE'),create(5,'same-code')]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1)
assert.equal((await db.query("select count(*)::int n from referral_partners where code='SAME-CODE'")).rows[0].n,1)
const before=(await db.query('select code from referral_partners where id=$1',[custom.id])).rows[0].code
await assert.rejects(()=>db.query("select referral_admin($1,'edit-code',$2)",[owner,{partner_id:custom.id,code:'OVERWRITE'}]),/Unknown/)
assert.equal((await db.query('select code from referral_partners where id=$1',[custom.id])).rows[0].code,before)
// Force repeated random collisions inside this isolated database only.
await db.exec("reset role;create or replace function public.referral_random_code() returns text language sql as $$select 'KTODD-SHOP'::text$$;set role service_role")
await assert.rejects(()=>create(6,null,true),/Could not generate a unique code/)
assert.equal((await db.query("select count(*)::int n from referral_partners where email='customer6@invalid.test'")).rows[0].n,0,'exhausted retries never overwrite or partially create')
for(const role of ['anon','authenticated']){
 await db.exec(`reset role;set role ${role}`);await assert.rejects(()=>create(7,'CUSTOM7'),/permission denied/)
 await assert.rejects(()=>db.query('select referral_random_code()'),/permission denied/)
}
await db.close();console.log('PASS referral code SQL: custom trim/case/format, generated alphabet, atomic collision recovery/exhaustion, duplicate email, concurrent uniqueness, no editing or overwrite, active-admin/service-only access')
