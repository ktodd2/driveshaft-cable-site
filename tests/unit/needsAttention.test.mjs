import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderQueues, possibleQuotePurchases, readAttentionRows } from '../../src/lib/needsAttention.js'
const paid = { id: 'paid', payment_status: 'paid', status: 'confirmed', actual_shipping_cost_cents: null }
test('fulfillment excludes unpaid, pending, failed, closed, explicitly test and refunded orders', () => {
  const excluded = [
    { payment_status: 'pending' }, { payment_status: 'failed' },
    ...['pending', 'cancelled', 'closed', 'refunded', 'unknown'].map(status => ({ status })),
    { is_test: true }, { test_mode: true }, { livemode: false },
    { refunded_at: '2026-01-01' }, { refunded_amount_cents: 100 },
  ].map((overrides, i) => ({ ...paid, id: i, ...overrides }))
  assert.deepEqual(orderQueues([paid, ...excluded]).fulfillment, [paid])
})
test('shipped missing tracking and confirmed with tracking never appear as fulfillment', () => {
  const shipped = { ...paid, id: 'shipped', status: 'shipped', tracking_number: '  ' }
  const tracked = { ...paid, id: 'tracked', tracking_number: '1Z123' }
  const delivered = { ...paid, id: 'delivered', status: 'delivered' }
  const queues = orderQueues([paid, shipped, tracked, delivered])
  assert.deepEqual(queues.fulfillment, [paid])
  assert.deepEqual(queues.tracking, [shipped])
  assert.deepEqual(queues.status, [tracked])
})
test('a recorded zero shipping cost is not missing; empty queues stay empty', () => {
  assert.deepEqual(orderQueues([{ ...paid, actual_shipping_cost_cents: 0 }]).shipping, [])
  assert.deepEqual(orderQueues([]), { fulfillment: [], tracking: [], status: [], shipping: [] })
})
function clientWithPages(pages) {
  let page = 0
  return { from() { return { select() { return this }, order() { return this }, range() { return Promise.resolve(pages[page++]) } } } }
}
test('reader loads beyond default row limit and rejects partial failures', async () => {
  const first = Array.from({ length: 500 }, (_, id) => ({ id }))
  assert.equal((await readAttentionRows(clientWithPages([{ data: first }, { data: first }, { data: [{ id: 1001 }] }]), 'orders')).length, 1001)
  await assert.rejects(readAttentionRows(clientWithPages([{ data: first }, { error: { message: 'offline' } }]), 'orders'))
  await assert.rejects(readAttentionRows(clientWithPages([{ data: null }]), 'orders'))
})

test('quote purchase evidence requires same email, eligible paid order and date at or after quote', () => {
  const quote = { email: ' Buyer@Example.com ', created_at: '2026-10-01T00:00:00Z' }
  const match = { ...paid, email: 'buyer@example.com', created_at: '2026-10-02T00:00:00Z' }
  assert.deepEqual(possibleQuotePurchases(quote, [match,
    { ...match, payment_status: 'pending' }, { ...match, status: 'cancelled' },
    { ...match, is_test: true }, { ...match, email: 'someoneelse@example.com' },
    { ...match, created_at: '2026-09-30T00:00:00Z' },
  ]), [match])
  assert.deepEqual(possibleQuotePurchases({ ...quote, email: '' }, [match]), [])
  assert.deepEqual(possibleQuotePurchases({ ...quote, created_at: null }, [match]), [])
})
