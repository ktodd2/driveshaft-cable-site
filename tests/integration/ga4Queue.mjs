// Run with GA4_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/integration/ga4Queue.mjs
// Isolated Postgres/WASM; never connects to any Supabase project.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { PGlite } = await import(process.env.GA4_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;')
await db.exec(readFileSync(new URL('../../supabase/migrations/20261028021709_ga4_purchase_outbox.sql', import.meta.url), 'utf8'))
const one = '00000000-0000-4000-8000-000000000001', two = '00000000-0000-4000-8000-000000000002'
for (const role of ['anon', 'authenticated']) {
 await db.exec(`set role ${role}`)
 await assert.rejects(db.query('select * from public.ga4_purchase_outbox'), /permission denied/)
 await assert.rejects(db.query('select * from public.claim_ga4_purchase()'), /permission denied/)
 await db.exec('reset role')
}
await db.exec('set role service_role')
await db.query("insert into public.ga4_purchase_outbox(order_id,intent_id,paid_at) values($1,'pi_1',now()),($2,'pi_2',now())", [one,two])
const a = (await db.query('select * from public.claim_ga4_purchase()')).rows[0]
const b = (await db.query('select * from public.claim_ga4_purchase()')).rows[0]
assert.notEqual(a.order_id,b.order_id)
assert.equal((await db.query('select * from public.claim_ga4_purchase()')).rows.length,0)
await db.query("update public.ga4_purchase_outbox set lease_until=now()-interval '1 second' where order_id=$1",[a.order_id])
const reclaimed = (await db.query('select * from public.claim_ga4_purchase()')).rows[0]
assert.equal(reclaimed.order_id,a.order_id); assert.notEqual(reclaimed.claim_token,a.claim_token)
assert.equal((await db.query("update public.ga4_purchase_outbox set state='sending' where order_id=$1 and claim_token=$2 returning *",[a.order_id,a.claim_token])).rows.length,0)
await db.query("update public.ga4_purchase_outbox set state='sending',lease_until=now()-interval '1 second' where order_id=$1",[a.order_id])
await db.query('select * from public.claim_ga4_purchase()')
assert.equal((await db.query('select state from public.ga4_purchase_outbox where order_id=$1',[a.order_id])).rows[0].state,'uncertain')
await db.query("insert into public.ga4_purchase_outbox(order_id,intent_id,paid_at) values($1,'pi_replay',now()) on conflict(order_id) do nothing",[a.order_id])
assert.equal((await db.query('select state from public.ga4_purchase_outbox where order_id=$1',[a.order_id])).rows[0].state,'uncertain')
await db.query("update public.ga4_purchase_outbox set state='submitted' where order_id=$1",[b.order_id])
assert.equal((await db.query('select * from public.claim_ga4_purchase()')).rows.length,0)
await assert.rejects(db.query("insert into public.ga4_purchase_outbox(order_id,intent_id,paid_at) values('00000000-0000-4000-8000-000000000003','pi_1',now())"), /unique constraint/)
await db.close()
console.log('PASS: SQL migration, service-only grants, exclusive claims, stale-token protection, crash quarantine, replay and intent uniqueness')
