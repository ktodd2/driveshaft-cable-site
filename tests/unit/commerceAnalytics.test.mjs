import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commercePayload, reportCommerceEvent, createCommerceVisit } from '../../src/lib/commerceAnalytics.js'

const lines = [{ productId: '1', quantity: 10, unitCents: 300 }, { productId: '3', quantity: 2, unitCents: 2199 }]
const harness = () => {
  const calls = []
  return { calls, browser: { location: { origin: 'https://example.test', search: '?email=private&token=secret' },
    dataLayer: [], navigator: {}, gtag: (...args) => calls.push(args) } }
}

test('mixed basket uses integer cents and counts brake-bolt packs as sold', () => {
  assert.deepEqual(commercePayload(lines), { currency: 'USD', value: 73.98,
    items: [{ item_id: '1', quantity: 10, price: 3 }, { item_id: '3', quantity: 2, price: 21.99 }] })
})

test('events omit arbitrary customer fields and URL secrets', () => {
  const { browser, calls } = harness()
  assert.equal(reportCommerceEvent('begin_checkout', lines.map(line => ({ ...line, email: 'private', token: 'secret', name: 'private name' })), browser), 'queued')
  assert.equal(calls[0][2].send_to, 'G-SDQTZK079P')
  assert.equal(calls[0][2].page_location, 'https://example.test/checkout')
  assert.doesNotMatch(JSON.stringify(calls), /private|secret|token|email/)
})

test('invalid or oversized payloads and purchase events cannot enter funnel sender', () => {
  const { browser, calls } = harness()
  for (const input of [[], null, [{ productId: 'bad@email', quantity: 1, unitCents: 10 }],
    [{ productId: '1', quantity: 0, unitCents: 300 }], [{ productId: '1', quantity: 1.5, unitCents: 300 }],
    [{ productId: '1', quantity: 1, unitCents: NaN }], [{ productId: '1', quantity: 1, unitCents: 2.1 }],
    [{ productId: '1', quantity: Number.MAX_SAFE_INTEGER, unitCents: 300 }], Array(201).fill(lines[0])]) {
    assert.equal(reportCommerceEvent('add_to_cart', input, browser), 'invalid')
  }
  assert.equal(reportCommerceEvent('purchase', lines, browser), 'invalid')
  assert.equal(calls.length, 0)
})

test('explicit consent denial, opt-out and global privacy control suppress events', () => {
  for (const policy of [{ dataLayer: [['consent', 'default', { analytics_storage: 'denied' }]] },
    { 'ga-disable-G-SDQTZK079P': true }, { navigator: { globalPrivacyControl: true } }]) {
    const { browser, calls } = harness()
    Object.assign(browser, policy)
    assert.equal(reportCommerceEvent('view_item', lines, browser), 'denied')
    assert.equal(calls.length, 0)
  }
})

test('unavailable and throwing analytics cannot throw into shopping code', () => {
  assert.equal(reportCommerceEvent('add_to_cart', lines, { navigator: {} }), 'unavailable')
  assert.equal(reportCommerceEvent('add_to_cart', lines, { navigator: {}, location: {}, gtag() { throw Error('blocked') } }), 'error')
})

test('visit sends once through rerenders, allows another product and can retry an unavailable tag', () => {
  const visit = createCommerceVisit()
  const { browser, calls } = harness()
  assert.equal(visit('view_item', '1', lines, { navigator: {} }), 'unavailable')
  assert.equal(visit('view_item', '1', lines, browser), 'queued')
  assert.equal(visit('view_item', '1', lines, browser), 'duplicate')
  assert.equal(visit('view_item', '3', lines, browser), 'queued')
  assert.equal(calls.length, 2)
})
