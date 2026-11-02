import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewShippingRows, shippingSourceKey } from '../../src/lib/shippingImport.js'
import { planAutomaticShipping, ledgerTimestamp, applyAutomaticShipping, loadShippingImportContext } from '../../src/lib/automaticShippingImport.js'
const now = Date.parse('2026-11-02T12:00:00Z')
const order = { id: 'one', name: 'Sample Customer', email: 'sample@example.invalid', payment_status: 'paid', status: 'shipped', created_at: '2026-10-28T12:00:00Z', actual_shipping_cost_cents: null, tracking_number: 'KEEP123' }
const ledger = (overrides = {}) => ({ Date: '10/29/26 10:40 PM CDT', Type: 'Label', Description: 'Sample Customer: 1 Label Batch', Total: '-5.25', Balance: '20.00', ...overrides })
const shipment = (overrides = {}) => ({ Name: order.name, Email: order.email, Cost: '5.25', 'Tracking Number': order.tracking_number, ...overrides })
const plan = (data, orders = [order], receipts = []) => planAutomaticShipping(reviewShippingRows(data, orders), orders, receipts, now)
test('observed ledger format auto-matches unique exact recipient with date guard', async () => {
  const p = await plan([ledger()]); assert.equal(p.groups.length, 1); assert.equal(p.groups[0].total, 525)
  assert.equal(ledgerTimestamp('10/29/26 10:40 PM CDT'), Date.parse('2026-10-30T03:40:00Z'))
  assert.equal(ledgerTimestamp('11/02/26 01:00 AM CST'), Date.parse('2026-11-02T07:00:00Z'))
  for (const date of ['02/30/26 01:00 PM CST', '10/29/26 22:00 PM CDT', 'garbage']) assert.ok(Number.isNaN(ledgerTimestamp(date)))
})
test('exact unique ledger name is never fuzzy-matched or chosen from multiple orders', async () => {
  assert.equal((await plan([ledger({ Description: 'SampleCustomer: 1 Label Batch' })])).groups.length, 0)
  const p = await plan([ledger()], [order, { ...order, id: 'two', payment_status: 'failed' }])
  assert.equal(p.groups.length, 0); assert.match(p.exceptions[0].reason, /More than one/)
})
test('ledger dates before order, too old, future, unknown zone and multi-label batches are exceptions', async () => {
  for (const override of [{ Date: '10/01/26 01:00 PM CDT' }, { Date: '12/01/26 01:00 PM CST' }, { Date: '10/29/26 01:00 PM PST' }, { Description: 'Sample Customer: 2 Label Batch' }]) assert.equal((await plan([ledger(override)])).groups.length, 0)
  assert.equal((await plan([ledger()], [{ ...order, created_at: '2026-08-01T00:00:00Z' }])).groups.length, 0)
})
test('exact tracking or name+email match automatically, conflicting identifiers do not', async () => {
  assert.equal((await plan([shipment()])).groups.length, 1)
  assert.equal((await plan([shipment({ 'Tracking Number': '' })])).groups.length, 1)
  for (const row of [shipment({ Name: 'Wrong Person' }), shipment({ 'Tracking Number': 'OTHER' }), shipment({ Email: 'wrong@example.invalid' })]) assert.equal((await plan([row])).groups.length, 0)
  assert.equal((await plan([{ Name: order.name, Cost: '5.25' }])).groups.length, 0)
})
test('ambiguous same recipient details and unpaid/cancelled/refunded orders are exceptions', async () => {
  assert.equal((await plan([shipment()], [order, { ...order, id: 'two' }])).groups.length, 0)
  for (const override of [{ payment_status: 'unpaid' }, { status: 'cancelled' }, { refunded_amount_cents: 5 }]) assert.equal((await plan([ledger()], [{ ...order, ...override }])).groups.length, 0)
})
test('existing real zero is protected, equal costs are noops, missing zero cost can save', async () => {
  assert.equal((await plan([ledger()], [{ ...order, actual_shipping_cost_cents: 0 }])).exceptions.length, 1)
  assert.equal((await plan([ledger()], [{ ...order, actual_shipping_cost_cents: 525 }])).unchanged, 1)
  assert.equal((await plan([ledger({ Total: '0' })])).groups[0].total, 0)
  assert.equal((await plan([ledger({ Total: '0' })], [{ ...order, actual_shipping_cost_cents: 0 }])).unchanged, 1)
})
test('duplicate rows are skipped once; conflicting copies and refunds stop entire label', async () => {
  const p = await plan([ledger(), ledger()]); assert.equal(p.groups.length, 1); assert.equal(p.skipped, 1)
  for (const extra of [shipment({ Cost: '8' }), shipment({ Status: 'Voided' })]) assert.equal((await plan([shipment(), extra])).groups.length, 0)
  assert.equal((await plan([ledger(), ledger({ Type: 'Refund', Total: '5.25' })])).groups.length, 0)
  const skip = await plan([ledger({ Type: 'Payment' }), ledger({ Type: 'Pickup' })]); assert.equal(skip.skipped, 2); assert.equal(skip.exceptions.length, 0)
})
test('multiple shipments to one order never save a partial total', async () => {
  const p = await plan([shipment(), shipment({ 'Tracking Number': '', Cost: '8' })])
  assert.equal(p.groups.length, 0); assert.equal(p.exceptions.length, 2)
  assert.equal((await plan([ledger(), ledger({ Date: '10/30/26 01:00 PM CDT' })])).groups.length, 0)
  assert.equal((await plan([shipment(), { Name: order.name, Cost: '8' }])).groups.length, 0)
})
test('repeat upload recognizes saved source identities; changed costs and additions are exceptions', async () => {
  const rows = reviewShippingRows([ledger()], [order]), key = await shippingSourceKey(rows[0].identity)
  const receipt = { order_id: 'one', source_keys: [key], labels: [{ source_key: key, cost_cents: 525 }], after_cost: 525 }
  const p = await plan([ledger()], [{ ...order, actual_shipping_cost_cents: 525 }], [receipt])
  assert.equal(p.groups.length, 0); assert.equal(p.alreadyImported, 1)
  assert.equal((await plan([ledger()], [{ ...order, actual_shipping_cost_cents: 800 }], [receipt])).exceptions.length, 1)
  const extra = await plan([shipment()], [order], [receipt]); assert.equal(extra.groups.length, 0); assert.equal(extra.exceptions.length, 1)
})
test('save calls only existing atomic RPC, preserves tracking, and reports per-order failure', async () => {
  const p = await plan([ledger(), ledger({ Description: 'Another Customer: 1 Label Batch' })], [order, { ...order, id: 'two', name: 'Another Customer' }])
  let calls = 0
  const client = { rpc: async (name, payload) => {
    assert.equal(name, 'apply_shipping_import'); assert.equal(payload.p_tracking, 'KEEP123'); assert.equal(payload.p_expected_tracking, 'KEEP123'); assert.equal(payload.p_expected_cost, null)
    return ++calls === 1 ? { error: { message: 'Order cost or tracking changed since preview.' } } : { data: { status: 'saved' } }
  } }
  const results = await applyAutomaticShipping(client, p, 'Transactions.xlsx')
  assert.deepEqual(results.map(r => r.status), ['error', 'saved'])
})
test('context loads all pages and fails closed if history or order read fails', async () => {
  const client = { from(table) { let start; return { select() { return this }, order() { return this }, range(a) { start=a; return Promise.resolve({data: table === 'orders' && start===0 ? Array.from({length:500},(_,id)=>({id})) : []}) } } } }
  assert.equal((await loadShippingImportContext(client)).orders.length, 500)
  const failed = { from() { return { select(){return this},order(){return this},range(){return Promise.resolve({error:{message:'offline'}})} } } }
  await assert.rejects(loadShippingImportContext(failed), /Unable to load/)
})
