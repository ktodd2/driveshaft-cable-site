import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { createPurchaseSnapshot, verifiedPurchaseResponse } from '../../supabase/functions/_shared/purchaseAnalytics.js'
import { rememberCheckoutPayment, getCheckoutPayment, clearPurchasedCart } from '../../src/lib/checkoutPayment.js'

const orderId = '00000000-0000-4000-8000-000000000001'
const secret = 'pi_offlineFixture_secret_offlineFixture'
const makeIntent = (patch = {}) => ({
  client_secret: secret, status: 'succeeded', livemode: true, currency: 'usd', amount: 7859, amount_received: 7859,
  metadata: { order_id: orderId, ga4_purchase: createPurchaseSnapshot([
    { productId: '1', quantity: 10, unitPrice: 300 },
    { productId: 'driveshaft-cable-cutters', quantity: 1, unitPrice: 2500 },
  ], 5500, 275, 2000, 634) },
  ...patch,
})
const response = intent => verifiedPurchaseResponse(intent, orderId, secret)

test('verified purchase uses immutable cents, exact discounted items, separate tax/shipping and no PII', () => {
  const intent = makeIntent({ receipt_email: 'never@example.test', shipping: { name: 'Private Customer' } })
  const { status, order, purchase } = response(intent)
  assert.equal(status, 'paid')
  assert.equal(order.total_cents, 7859)
  assert.deepEqual(purchase, { transaction_id: orderId, currency: 'USD', value: 52.25, shipping: 20, tax: 6.34,
    items: [{ item_id: '1', price: 2.85, quantity: 10, discount: 0.15 },
      { item_id: 'driveshaft-cable-cutters', price: 23.75, quantity: 1, discount: 1.25 }] })
  assert.ok(!JSON.stringify(response(intent)).includes('Private'))
  assert.ok(!JSON.stringify(response(intent)).includes('secret'))
})

test('integer discount allocation preserves totals even for fractional-cent unit discounts', () => {
  for (const discount of [0, 1, 2, 5, 9, 11, 2999, 3000]) {
    const intent = makeIntent({ amount: 3000 - discount, amount_received: 3000 - discount,
      metadata: { order_id: orderId, ga4_purchase: createPurchaseSnapshot([{ productId: '1', quantity: 10, unitPrice: 300 }], 3000, discount, 0, 0) } })
    const { purchase } = response(intent)
    assert.equal(Math.round(purchase.items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100), 3000 - discount)
    assert.equal(purchase.items.reduce((sum, i) => sum + i.quantity, 0), 10)
  }
})

test('secret and order binding are required, never client flags or order paid state', () => {
  assert.equal(verifiedPurchaseResponse(makeIntent(), orderId, 'wrong'), null)
  assert.equal(verifiedPurchaseResponse(makeIntent(), 'another-order', secret), null)
  for (const status of ['processing', 'requires_action', 'requires_confirmation', 'requires_capture']) {
    assert.deepEqual(response(makeIntent({ status })), { status: 'pending' })
  }
  for (const status of ['canceled', 'requires_payment_method']) assert.deepEqual(response(makeIntent({ status })), { status: 'failed' })
})

test('old/test intents and invalid, inconsistent snapshots never emit analytics', () => {
  for (const patch of [
    { livemode: false }, { currency: 'cad' }, { amount_received: 0 }, { amount: 1 },
    { metadata: { order_id: orderId } }, { metadata: { order_id: orderId, ga4_purchase: '{broken' } },
  ]) assert.equal(response(makeIntent(patch)).purchase, null)
  const snapshot = JSON.parse(makeIntent().metadata.ga4_purchase)
  for (const bad of [{ ...snapshot, d: 6000 }, { ...snapshot, i: [['1', -1, 300]] }, { ...snapshot, i: [['email@example.test', 10, 550]] }, { ...snapshot, s: 5500.5 }]) {
    assert.equal(response(makeIntent({ metadata: { order_id: orderId, ga4_purchase: JSON.stringify(bad) } })).purchase, null)
  }
  assert.equal(createPurchaseSnapshot(Array.from({ length: 100 }, (_, i) => ({ productId: `product-${i}`, quantity: 10, unitPrice: 300 })), 300000, 0, 0, 0), null)
})

async function browserHarness() {
  const analytics = await import(`../../src/lib/purchaseAnalytics.js?test=${Math.random()}`)
  const calls = [], saved = new Map()
  const browser = { dataLayer: [], location: { origin: 'https://example.test' }, navigator: {},
    gtag: (...args) => calls.push(args),
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
  }
  return { ...analytics, browser, calls, saved }
}

test('event is allowlisted, sent to existing GA ID, deduplicated on rerender and reload', async () => {
  const h = await browserHarness(), purchase = response(makeIntent()).purchase
  purchase.email = 'never@example.test'; purchase.items[0].item_name = 'Private Name'
  assert.equal(await h.reportPurchase(purchase, h.browser), 'queued')
  assert.equal(await h.reportPurchase(purchase, h.browser), 'duplicate')
  const fresh = await browserHarness()
  assert.equal(await fresh.reportPurchase(purchase, h.browser), 'duplicate')
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0][1], 'purchase')
  assert.equal(h.calls[0][2].send_to, 'G-SDQTZK079P')
  assert.equal(h.calls[0][2].page_location, 'https://example.test/checkout/success')
  assert.ok(!JSON.stringify(h.calls).includes('Private'))
  assert.ok(!JSON.stringify(h.calls).includes('never@'))
})

test('denied consent, opt-out and absent/throwing tag are retryable and not marked sent', async () => {
  const h = await browserHarness(), purchase = response(makeIntent()).purchase
  h.browser.dataLayer = [['consent', 'default', { analytics_storage: 'denied' }]]
  assert.equal(await h.reportPurchase(purchase, h.browser), 'denied')
  assert.equal(h.saved.size, 0)
  h.browser.dataLayer.push(['consent', 'update', { analytics_storage: 'granted' }])
  h.browser['ga-disable-G-SDQTZK079P'] = true
  assert.equal(await h.reportPurchase(purchase, h.browser), 'denied')
  h.browser['ga-disable-G-SDQTZK079P'] = false
  const gtag = h.browser.gtag
  h.browser.gtag = undefined
  assert.equal(await h.reportPurchase(purchase, h.browser), 'unavailable')
  h.browser.gtag = () => { throw new Error('blocked') }
  assert.equal(await h.reportPurchase(purchase, h.browser), 'error')
  assert.equal(h.saved.size, 0)
  h.browser.gtag = gtag
  assert.equal(await h.reportPurchase(purchase, h.browser), 'queued')
})

test('storage exceptions never break confirmation and in-memory dedup still works', async () => {
  const h = await browserHarness(), purchase = response(makeIntent()).purchase
  h.browser.localStorage = { getItem() { throw 0 }, setItem() { throw 0 } }
  assert.equal(await h.reportPurchase(purchase, h.browser), 'queued')
  assert.equal(await h.reportPurchase(purchase, h.browser), 'duplicate')
  assert.equal(h.calls.length, 1)
})

test('malformed or inconsistent frontend payload cannot report', async () => {
  const h = await browserHarness(), purchase = response(makeIntent()).purchase
  for (const bad of [null, { ...purchase, transaction_id: '' }, { ...purchase, value: 1 }, { ...purchase, currency: 'CAD' }, { ...purchase, items: [] }]) {
    assert.equal(await h.reportPurchase(bad, h.browser), 'invalid')
  }
  assert.equal(h.calls.length, 0)
})

test('return bootstrap strips secrets before GA, with session and memory fallback', () => {
  const script = readFileSync(new URL('../../public/payment-return.js', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  assert.ok(html.indexOf('/payment-return.js') < html.indexOf('googletagmanager.com'))
  for (const blocked of [false, true]) {
    const saved = new Map(), replacements = []
    const window = {
      location: { pathname: '/checkout/success', search: `?order=${orderId}&payment_intent_client_secret=${secret}&redirect_status=succeeded&email=private` },
      history: { state: null, replaceState: (...args) => replacements.push(args[2]) },
      sessionStorage: { setItem(key, val) { if (blocked) throw 0; saved.set(key, val) } },
    }
    runInNewContext(script, { window, URLSearchParams, Date })
    assert.equal(replacements[0], `/checkout/success?order=${orderId}`)
    assert.equal(window.__checkoutPayment.clientSecret, secret)
    assert.equal(getCheckoutPayment(orderId, window).clientSecret, secret)
  }
})

test('checkout capability is tab-local, bound to order, and expires', () => {
  const saved = new Map()
  const browser = { sessionStorage: { setItem: (k, v) => saved.set(k, v), getItem: k => saved.get(k) } }
  rememberCheckoutPayment(orderId, secret, browser)
  assert.equal(getCheckoutPayment(orderId, browser).clientSecret, secret)
  assert.equal(getCheckoutPayment('other', browser), null)
  browser.__checkoutPayment.savedAt = 0
  assert.equal(getCheckoutPayment(orderId, browser), null)
})

test('actual verification handler is read-only, authorized by secret, sanitized and no-store', async () => {
  let handler, retrieved = []
  const source = readFileSync(new URL('../../supabase/functions/verify-purchase/index.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
  class Stripe { constructor() { this.paymentIntents = { retrieve: async id => { retrieved.push(id); return makeIntent() } } } }
  runInNewContext(stripTypeScriptTypes(source), { serve: fn => { handler = fn }, Stripe, verifiedPurchaseResponse,
    Deno: { env: { get: () => 'offline-fixture-only' } }, Response, JSON })
  const call = body => handler(new Request('https://offline.test', { method: 'POST', body: JSON.stringify(body) }))
  let res = await call({ orderId, clientSecret: secret })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await res.json(), response(makeIntent()))
  assert.deepEqual(retrieved, ['pi_offlineFixture'])
  res = await call({ orderId, clientSecret: 'pi_offlineFixture_secret_wrong' })
  assert.equal(res.status, 403)
  assert.ok(!(await res.text()).includes('wrong'))
  assert.equal((await call({ orderId, redirect_status: 'succeeded' })).status, 400)
  assert.equal((await handler(new Request('https://offline.test'))).status, 405)
  assert.ok(!source.includes('.update(') && !source.includes('.from('))
})


test('only the matching checkout cart is cleared once, never new items on revisit', () => {
  const saved = new Map(), browser = { sessionStorage: { setItem: (k, v) => saved.set(k, v), getItem: k => saved.get(k) } }
  const oldItems = [{ productId: '1', quantity: 10 }], newItems = [{ productId: '2', quantity: 20 }]
  let clears = 0
  rememberCheckoutPayment(orderId, secret, browser, oldItems)
  clearPurchasedCart(orderId, oldItems, () => clears++, browser)
  clearPurchasedCart(orderId, newItems, () => clears++, browser)
  assert.equal(clears, 1)
  rememberCheckoutPayment(orderId, secret, browser, oldItems)
  clearPurchasedCart(orderId, newItems, () => clears++, browser)
  assert.equal(clears, 1)
})
