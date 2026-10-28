import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyticsMetadata, queueEntry, enqueuePurchase, measurementPayload, transmitPurchase } from '../../supabase/functions/_shared/ga4Outbox.js'
import { createPurchaseSnapshot, verifiedPurchaseResponse } from '../../supabase/functions/_shared/purchaseAnalytics.js'
import { captureAnalyticsContext } from '../../src/lib/purchaseAnalytics.js'
const orderId = '00000000-0000-4000-8000-000000000001'
const now = 1793000000000
const intent = () => ({ id: 'pi_fixture', client_secret: 'fixture', livemode: true, status: 'succeeded', currency: 'usd', amount: 10100, amount_received: 10100,
  latest_charge: { paid: true, amount_refunded: 0, disputed: false },
  metadata: { order_id: orderId, ...analyticsMetadata({ allowed: true, client_id: '123.456', session_id: now / 1000 - 100 }, true),
    ga4_purchase: createPurchaseSnapshot([{ productId: '1', quantity: 30, unitPrice: 270, analyticsName: 'Driveshaft Cable', name: 'Private Customer' }], 8100, 0, 2000, 0) } })
const event = () => ({ type: 'payment_intent.succeeded', created: now / 1000, livemode: true, data: { object: intent() } })

test('verified success creates queue entry without browser return; browser relinquishes ownership', () => {
  const e = event(), row = queueEntry(e)
  assert.equal(row.order_id, orderId)
  assert.deepEqual(Object.keys(row).sort(), ['intent_id','order_id','paid_at'])
  assert.equal(verifiedPurchaseResponse(e.data.object, orderId, 'fixture').purchase, null)
  const { payload } = measurementPayload(e.data.object, row, now)
  assert.equal(payload.events[0].params.value, 81)
  assert.equal(payload.events[0].params.shipping, 20)
  assert.equal(payload.events[0].params.items[0].item_name, 'Driveshaft Cable')
  assert.equal(payload.client_id, '123.456')
  assert.equal(payload.timestamp_micros, now * 1000)
  assert.equal(payload.events[0].params.session_id, now / 1000 - 100)
  assert.ok(!JSON.stringify(payload).includes('Private'))
  assert.ok(!JSON.stringify(payload).includes('secret'))
})
test('pending, failed, test, legacy, malformed and unbound events cannot enter queue', () => {
  for (const change of [e => e.type = 'payment_intent.payment_failed', e => e.livemode = false,
    e => e.data.object.livemode = false, e => e.data.object.status = 'processing',
    e => delete e.data.object.metadata.ga4_reporting, e => e.data.object.metadata.order_id = 'bad',
    e => e.data.object.metadata.ga4_client_id = 'customer@example.test', e => e.data.object.amount_received = 1]) {
    const e = event(); change(e); assert.equal(queueEntry(e), null)
  }
})
test('feature flag and actual allowed numeric client ID required; metadata drops arbitrary fields', () => {
  for (const context of [null, { allowed: false, client_id: '123.456' }, { allowed: true, client_id: 'private@example.test' }]) assert.deepEqual(analyticsMetadata(context, true), {})
  assert.deepEqual(analyticsMetadata({ allowed: true, client_id: '123.456' }, false), {})
  assert.deepEqual(analyticsMetadata({ allowed: true, client_id: '123.456', email: 'private' }, true), { ga4_reporting: 'server_v1', ga4_client_id: '123.456' })
})
test('enqueue preserves existing state on replay and surfaces durable-write failure', async () => {
  let calls = 0
  const db = { from: table => { assert.equal(table, 'ga4_purchase_outbox'); return { upsert: async (row, options) => { calls++; assert.deepEqual(options, { onConflict: 'order_id', ignoreDuplicates: true }); assert.equal(row.order_id, orderId); return {} } } } }
  await enqueuePurchase(db, event()); await enqueuePurchase(db, event()); assert.equal(calls, 2)
  await assert.rejects(enqueuePurchase({ from: () => ({ upsert: async () => ({ error: 'offline' }) }) }, event()), /enqueue_failed/)
})
test('refund, dispute, missing charge, wrong binding, stale events excluded before transmission', () => {
  const row = queueEntry(event())
  for (const patch of [{ latest_charge: null }, { latest_charge: { paid: true, amount_refunded: 1 } }, { latest_charge: { paid: true, amount_refunded: 0, disputed: true } }, { id: 'pi_wrong' }, { status: 'processing' }]) assert.ok(measurementPayload({ ...intent(), ...patch }, row, now).skip)
  assert.equal(measurementPayload(intent(), row, now + 72 * 3600000).skip, 'expired')
  const oldSession = intent(); oldSession.metadata.ga4_session_id = String(now / 1000 - 90000)
  assert.equal(measurementPayload(oldSession, row, now).payload.events[0].params.session_id, undefined)
})
test('transport result is honest and no HTTP failure is automatically retried', async () => {
  for (const [fetcher, expected] of [[async () => ({ ok: true }), 'submitted'], [async () => ({ ok: false }), 'rejected'], [async () => { throw Error('timeout') }, 'uncertain']]) {
    let calls = 0
    assert.equal(await transmitPurchase({}, 'offline-fixture', async (...args) => { calls++; return fetcher(...args) }), expected)
    assert.equal(calls, 1)
  }
})
test('capture uses real tag get values, respects denial/GPC/opt-out and bounded blocked-tag wait', async () => {
  const browser = { dataLayer: [], navigator: {}, gtag: (_get, _id, field, callback) => callback(field === 'client_id' ? '123.456' : 123) }
  assert.deepEqual(await captureAnalyticsContext(browser), { allowed: true, client_id: '123.456', session_id: 123 })
  for (const extra of [{ navigator: { globalPrivacyControl: true } }, { 'ga-disable-G-SDQTZK079P': true }, { dataLayer: [['consent', 'default', { analytics_storage: 'denied' }]] }]) assert.equal(await captureAnalyticsContext({ ...browser, ...extra }), null)
  assert.equal(await captureAnalyticsContext({ ...browser, gtag() {} }, 1), null)
  const revoked = { ...browser, dataLayer: [] }
  revoked.gtag = (_get, _id, _field, callback) => { revoked.dataLayer.push(['consent', 'update', { analytics_storage: 'denied' }]); callback('123.456') }
  assert.equal(await captureAnalyticsContext(revoked), null)
})
