import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
const admin='10000000-0000-4000-8000-000000000001',inactive='10000000-0000-4000-8000-000000000002',id='20000000-0000-4000-8000-000000000001'
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;create table admin_users(id uuid,is_active boolean);insert into admin_users values('${admin}',true),('${inactive}',false);`)
await db.exec(await fs.readFile('supabase/migrations/suggestions.sql','utf8'))
await db.exec(`grant all on suggestions to anon,authenticated,service_role;insert into suggestions(id,email,name,message,status)values('${id}','fixture@example.test','Keep name','123456','new');`)
await db.exec(await fs.readFile('supabase/migrations/20261101070000_suggestion_review.sql','utf8'))
for(const actor of ['',inactive,'10000000-0000-4000-8000-000000000003']){
 await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[actor]);await db.exec('set role authenticated')
 for(const sql of ['select get_suggestion_review()','select get_suggestion_attention()',`select review_suggestion('${id}',0,'quarantine')`])await assert.rejects(()=>db.query(sql),/Active admin/)
}
await db.exec('reset role;set role anon')
await db.query("insert into suggestions(email,message)values('public@example.test','Genuine short request')")
for(const sql of ['select * from suggestions','select get_suggestion_review()',"insert into suggestions(email,message,status)values('x@test.com','x','read')", "insert into suggestions(email,message,review_state)values('x@test.com','x','kept')"])await assert.rejects(()=>db.query(sql),/permission denied/)
await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[admin]);await db.exec('set role authenticated')
for(const sql of ['select * from suggestions','delete from suggestions',"update suggestions set status='read'"])await assert.rejects(()=>db.query(sql),/permission denied/)
const snapshot=async()=>(await db.query('select get_suggestion_review() s')).rows[0].s
let s=await snapshot();assert.equal(s.counts.attention,2);assert.equal(s.rows.find(r=>r.id===id).review_revision,0)
await db.query(`select review_suggestion('${id}',0,'quarantine')`)
s=await snapshot();assert.equal(s.counts.attention,1);assert.equal(s.counts.quarantined,1);assert.equal(s.rows.find(r=>r.id===id).status,'new')
await assert.rejects(()=>db.query(`select review_suggestion('${id}',0,'quarantine')`),/Record changed/)
await assert.rejects(()=>db.query(`select review_suggestion('${id}',0,'read')`),/Record changed/)
await db.query(`select review_suggestion('${id}',1,'restore')`)
s=await snapshot();assert.equal(s.counts.attention,2);assert.equal(s.rows.find(r=>r.id===id).review_state,'kept')
await db.query(`select review_suggestion('${id}',2,'read')`);assert.equal((await snapshot()).counts.attention,1)
await db.exec(`reset role;update suggestions set name='Edited by other session',status='archived' where id='${id}';set role authenticated`)
await assert.rejects(()=>db.query(`select review_suggestion('${id}',3,'new')`),/Record changed/)
s=await snapshot();const row=s.rows.find(r=>r.id===id);assert.equal(row.name,'Edited by other session');assert.equal(row.message,'123456');assert.equal(row.status,'archived');assert.equal(row.review_revision,4)
await assert.rejects(()=>db.query(`select review_suggestion('${id}',4,'delete')`),/Invalid action/)
assert.equal((await db.query('select get_suggestion_attention() s')).rows[0].s.attention,s.counts.attention)
await db.close();console.log('PASS suggestion migration: no backfill, public insert only, active-admin RPCs, preserved content/status, repeated/stale decisions, legacy edit revision, badge agreement')
