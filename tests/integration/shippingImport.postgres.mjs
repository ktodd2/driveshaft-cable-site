// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// All schema and writes live in an ephemeral in-memory PostgreSQL instance.
import assert from 'node:assert/strict'
import { reviewShippingRows } from '../../src/lib/shippingImport.js'
import { planAutomaticShipping, applyAutomaticShipping } from '../../src/lib/automaticShippingImport.js'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.actor', true), '')::uuid $$;
CREATE TABLE public.admin_users(id uuid PRIMARY KEY, is_active boolean);
INSERT INTO admin_users VALUES ('00000000-0000-0000-0000-000000000001', true), ('00000000-0000-0000-0000-000000000002', false);
CREATE TABLE public.orders(id uuid PRIMARY KEY, actual_shipping_cost_cents integer, tracking_number text, updated_at timestamptz, status text DEFAULT 'confirmed');
INSERT INTO orders(id, tracking_number) VALUES ('10000000-0000-0000-0000-000000000001', 'OLD'), ('10000000-0000-0000-0000-000000000002', NULL);
SET app.actor = '00000000-0000-0000-0000-000000000001';
`)
await db.exec(await readFile(new URL('../../supabase/migrations/20261101010000_shipping_import_review.sql', import.meta.url), 'utf8'))
const a = '10000000-0000-0000-0000-000000000001', b = '10000000-0000-0000-0000-000000000002'
const labels = [{ source_key: 'a'.repeat(64), cost_cents: 500 }, { source_key: 'b'.repeat(64), cost_cents: 0 }]
const run = async (id = a, expected = null, beforeTracking = 'OLD', afterTracking = 'OLD', items = labels) => (await db.query('SELECT public.apply_shipping_import($1,$2,$3,$4,$5,$6) result', [id, expected, beforeTracking, afterTracking, JSON.stringify(items), 'fixture.csv'])).rows[0].result
assert.equal((await run()).status, 'saved')
assert.equal((await run()).status, 'already_applied') // lost-response retry, stale before-values
assert.equal((await run(a, 500, 'OLD', 'OLD', [...labels].reverse())).status, 'already_applied')
await assert.rejects(run(b, null, null, null), /already imported/)
await assert.rejects(run(a, 500, 'OLD', 'OLD', [labels[0]]), /already imported/)
const fresh = [{ source_key: 'c'.repeat(64), cost_cents: 0, tracking: 'NEW' }]
await assert.rejects(run(a, null, 'OLD', 'NEW', fresh), /changed since preview/)
assert.equal((await run(a, 500, 'OLD', 'NEW', fresh)).status, 'saved')
assert.equal((await db.query('SELECT actual_shipping_cost_cents, tracking_number, status FROM orders WHERE id=$1', [a])).rows[0].actual_shipping_cost_cents, 0)
assert.equal((await db.query('SELECT tracking_number, status FROM orders WHERE id=$1', [a])).rows[0].status, 'confirmed')
await assert.rejects(run(), /already imported/)
await assert.rejects(run(b, null, null, null, [fresh[0], fresh[0]]), /Duplicate/)
await assert.rejects(run(b, null, null, null, [{ source_key: 'd'.repeat(64), cost_cents: -1 }]), /Invalid/)
await assert.rejects(run(b, null, null, '<img src=x>', [{ source_key: 'f'.repeat(64), cost_cents: 0, tracking: '<img src=x>' }]), /Invalid source tracking/)
await assert.rejects(run(b, null, null, 'UNSELECTED', [{ source_key: 'f'.repeat(64), cost_cents: 0 }]), /Replacement tracking/)
await db.exec("SET app.actor = '00000000-0000-0000-0000-000000000002'")
await assert.rejects(run(), /Active admin/)
await db.exec("SET app.actor = ''")
await assert.rejects(run(), /Active admin/)
await db.exec("SET app.actor = '00000000-0000-0000-0000-000000000001'")
// Force an order-write failure AFTER receipt/source inserts. Everything must roll back.
await db.exec(`CREATE FUNCTION fail_fixture_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture write failure'; END $$;
CREATE TRIGGER fixture_failure BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION fail_fixture_order();`)
await assert.rejects(run(b, null, null, null, [{ source_key: 'e'.repeat(64), cost_cents: 100 }]), /fixture write failure/)
assert.equal((await db.query("SELECT count(*)::int n FROM shipping_import_sources WHERE source_key = repeat('e',64)")).rows[0].n, 0)
assert.equal((await db.query('SELECT count(*)::int n FROM shipping_import_receipts')).rows[0].n, 2)
await db.exec('DROP TRIGGER fixture_failure ON orders;')
assert.equal((await run(b, null, null, null, [{ source_key: 'e'.repeat(64), cost_cents: 100 }])).status, 'saved')
// Authenticated callers can execute the function but cannot mutate audit history.
await db.exec('GRANT USAGE ON SCHEMA public, auth TO authenticated; GRANT SELECT ON admin_users TO authenticated; SET ROLE authenticated;')
await assert.rejects(db.exec('DELETE FROM shipping_import_sources'), /permission denied/)
assert.equal((await db.query('SELECT count(*)::int n FROM shipping_import_receipts')).rows[0].n, 3)
await db.exec("SET app.actor = '00000000-0000-0000-0000-000000000002'")
assert.equal((await db.query('SELECT count(*)::int n FROM shipping_import_receipts')).rows[0].n, 0)
await assert.rejects(run(), /Active admin/)
await db.exec('RESET ROLE; SET ROLE anon;')
await assert.rejects(run(), /permission denied/)
// Exercise the upload planner against the unchanged real PostgreSQL save function.
await db.exec("RESET ROLE; SET app.actor = '00000000-0000-0000-0000-000000000001'")
const autoId = '10000000-0000-0000-0000-000000000003'
await db.query('INSERT INTO orders(id, tracking_number) VALUES ($1,$2)', [autoId, 'AUTOKEEP'])
const autoOrder = { id: autoId, name: 'Auto Fixture', email: 'auto@example.invalid', payment_status: 'paid', status: 'confirmed', actual_shipping_cost_cents: null, tracking_number: 'AUTOKEEP' }
const autoRows = reviewShippingRows([{ Name: autoOrder.name, Email: autoOrder.email, Cost: '0', 'Tracking Number': 'AUTOKEEP' }], [autoOrder])
const autoPlan = await planAutomaticShipping(autoRows, [autoOrder])
const adapter = { async rpc(name, p) {
  assert.equal(name, 'apply_shipping_import')
  try { return { data: (await db.query('SELECT public.apply_shipping_import($1,$2,$3,$4,$5,$6) result', [p.p_order_id,p.p_expected_cost,p.p_expected_tracking,p.p_tracking,JSON.stringify(p.p_labels),p.p_filename])).rows[0].result } }
  catch(error) { return { error } }
} }
assert.equal((await applyAutomaticShipping(adapter, autoPlan, 'auto.csv'))[0].status, 'saved')
const savedAuto = (await db.query('SELECT * FROM orders WHERE id=$1', [autoId])).rows[0]
assert.equal(savedAuto.actual_shipping_cost_cents, 0); assert.equal(savedAuto.tracking_number, 'AUTOKEEP'); assert.equal(savedAuto.status, 'confirmed')
const autoReceipts = (await db.query('SELECT * FROM shipping_import_receipts')).rows
const repeatPlan = await planAutomaticShipping(autoRows, [{ ...autoOrder, actual_shipping_cost_cents: 0 }], autoReceipts)
assert.equal(repeatPlan.groups.length, 0); assert.equal(repeatPlan.alreadyImported, 1)
const staleRows = reviewShippingRows([{ Name: autoOrder.name, Email: autoOrder.email, Cost: '5' }], [autoOrder])
const stalePlan = await planAutomaticShipping(staleRows, [autoOrder])
assert.equal((await applyAutomaticShipping(adapter, stalePlan, 'stale.csv'))[0].status, 'error')
assert.equal((await db.query('SELECT actual_shipping_cost_cents FROM orders WHERE id=$1', [autoId])).rows[0].actual_shipping_cost_cents, 0)
console.log('Automatic planner + real PostgreSQL checks passed: zero save, preserved tracking/status, repeat-file skip and concurrent-cost rejection.')
console.log('PostgreSQL fixture checks passed: atomic saves, replay, cross-order duplicates, reordered labels, zero, stale conflicts, rollback/retry, admin authorization and audit RLS.')
await db.close()
