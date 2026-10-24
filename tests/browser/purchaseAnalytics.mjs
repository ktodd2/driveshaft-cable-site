// Offline browser QA. Every external request is mocked or blocked; no Stripe,
// Supabase, GA or ad request reaches a live service, and no payment is created.
// Run against Vite with mock env vars (see docs/purchase-analytics.md).
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4175'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const id = '00000000-0000-4000-8000-000000000001'
const secret = 'pi_offlineFixture_secret_offlineFixture'
const paid = { status: 'paid', order: { subtotal_cents: 3000, discount_cents: 300, shipping_cents: 2000, tax_cents: 200, total_cents: 4900 },
  purchase: { transaction_id: id, currency: 'USD', value: 27, shipping: 20, tax: 2, items: [{ item_id: '1', quantity: 10, price: 2.7, discount: 0.3 }] } }
const purchaseCount = page => page.evaluate(() => (window.dataLayer || []).filter(args => args[0] === 'event' && args[1] === 'purchase').length)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const initialItems = [{ productId: '1', name: 'Cable', quantity: 10, price: 300 }]
async function scenario({ responses = [paid], stored = true, denied = false } = {}) {
  const context = await browser.newContext()
  const writes = [], verifies = [], outside = []
  await context.addInitScript(({ id, secret, stored, denied, initialItems }) => {
    if (stored && !sessionStorage.getItem('ktodd-checkout-payment')) {
      sessionStorage.setItem('ktodd-checkout-payment', JSON.stringify({ orderId: id, clientSecret: secret, savedAt: Date.now(), cartSignature: JSON.stringify([['1', 10]]) }))
      localStorage.setItem('ktodd-cart', JSON.stringify({ state: { items: initialItems }, version: 0 }))
    }
    if (denied) window.dataLayer = [['consent', 'default', { analytics_storage: 'denied' }]]
  }, { id, secret, stored, denied, initialItems })
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin === BASE) return route.continue()
    outside.push({ host: url.host, referrer: req.headers().referer || '' })
    if (url.hostname === 'mockref.supabase.co') {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      if (url.pathname.endsWith('/verify-purchase')) {
        verifies.push(JSON.parse(req.postData()))
        const result = responses[Math.min(verifies.length - 1, responses.length - 1)]
        return route.fulfill({ status: result.error ? 503 : 200, headers, contentType: 'application/json', body: JSON.stringify(result) })
      }
      if (!['GET', 'HEAD'].includes(req.method())) writes.push({ path: url.pathname, body: req.postData() })
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: '[]' })
    }
    if (url.hostname === 'www.googletagmanager.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.__tagLoadUrl = location.href;' })
    if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe = function(){return {}};' })
    return route.abort()
  })
  const page = await context.newPage()
  return { context, page, writes, verifies, outside }
}
try {
  // Non-redirect return, reload and Back/Forward. Markers are retained while a new cart is safe.
  {
    const s = await scenario()
    await s.page.goto(`${BASE}/checkout/success?order=${id}`)
    await s.page.getByRole('heading', { name: 'ORDER CONFIRMED!' }).waitFor()
    await s.page.waitForFunction(() => window.dataLayer.some(args => args[1] === 'purchase'))
    assert.equal(await purchaseCount(s.page), 1)
    assert.equal(s.verifies[0].clientSecret, secret)
    const event = await s.page.evaluate(() => Array.from(window.dataLayer.find(args => args[1] === 'purchase'))[2])
    assert.equal(event.value, 27); assert.equal(event.shipping, 20); assert.equal(event.tax, 2)
    assert.ok(!JSON.stringify(event).includes('secret'))
    await s.page.evaluate(() => localStorage.setItem('ktodd-cart', JSON.stringify({ state: { items: [{ productId: '2', quantity: 20, price: 350 }] }, version: 0 })))
    await s.page.reload()
    await s.page.getByRole('heading', { name: 'ORDER CONFIRMED!' }).waitFor()
    assert.equal(await purchaseCount(s.page), 0)
    assert.equal(await s.page.evaluate(() => JSON.parse(localStorage.getItem('ktodd-cart')).state.items[0].productId), '2')
    await s.page.goto(`${BASE}/products`); await s.page.goBack()
    await s.page.getByRole('heading', { name: 'ORDER CONFIRMED!' }).waitFor()
    assert.equal(await purchaseCount(s.page), 0)
    await s.context.close()
    console.log('PASS: non-redirect, reload/Back dedup and new cart preservation')
  }
  // Stripe redirect: strip secret before analytics JS loads, do not rely on URL status.
  {
    const s = await scenario({ stored: false })
    await s.page.goto(`${BASE}/checkout/success?order=${id}&payment_intent_client_secret=${secret}&redirect_status=failed`)
    await s.page.getByRole('heading', { name: 'ORDER CONFIRMED!' }).waitFor()
    assert.ok(!(await s.page.evaluate(() => window.__tagLoadUrl)).includes('secret'))
    assert.equal(new URL(s.page.url()).search, `?order=${id}`)
    assert.ok(s.outside.every(req => !req.referrer.includes('secret')))
    assert.equal(await purchaseCount(s.page), 1)
    await s.context.close()
    console.log('PASS: redirected success independently verified and secret stripped before GA')
  }
  // A forged success query never calls verification, marks an order paid or emits an event.
  {
    const s = await scenario({ stored: false })
    await s.page.goto(`${BASE}/checkout/success?order=${id}&redirect_status=succeeded`)
    await s.page.getByRole('heading', { name: 'PAYMENT NOT YET VERIFIED' }).waitFor()
    assert.equal(await purchaseCount(s.page), 0); assert.equal(s.writes.length, 0); assert.equal(s.verifies.length, 0)
    await s.context.close()
    console.log('PASS: forged success URL cannot produce paid state, writes or purchase')
  }
  // Webhook timing is irrelevant to the server-confirmed payment; pending itself never reports.
  {
    const s = await scenario({ responses: [{ status: 'pending' }, paid] })
    await s.page.goto(`${BASE}/checkout/success?order=${id}`)
    await s.page.getByRole('heading', { name: 'PAYMENT PROCESSING' }).waitFor()
    assert.equal(await purchaseCount(s.page), 0); assert.equal(s.writes.length, 0)
    await s.page.getByRole('heading', { name: 'ORDER CONFIRMED!' }).waitFor({ timeout: 10000 })
    assert.equal(await purchaseCount(s.page), 1)
    assert.ok(s.writes.every(req => req.path.endsWith('/orders')))
    await s.context.close()
    console.log('PASS: pending-to-paid reconciliation only reports after verification')
  }
  for (const response of [{ status: 'failed' }, { error: 'offline' }]) {
    const s = await scenario({ responses: [response] })
    await s.page.goto(`${BASE}/checkout/success?order=${id}&redirect_status=succeeded`)
    await s.page.getByRole('heading', { name: response.error ? 'PAYMENT NOT YET VERIFIED' : 'PAYMENT FAILED' }).waitFor()
    assert.equal(await purchaseCount(s.page), 0); assert.equal(s.writes.length, 0)
    await s.context.close()
  }
  console.log('PASS: canceled/failed and verification errors never report or mark paid')
  {
    const s = await scenario({ denied: true })
    await s.page.goto(`${BASE}/checkout/success?order=${id}`)
    await s.page.getByRole('heading', { name: 'ORDER CONFIRMED!' }).waitFor()
    assert.equal(await purchaseCount(s.page), 0)
    assert.equal(await s.page.evaluate(id => localStorage.getItem(`ktodd-ga4-purchase:${id}`), id), null)
    await s.page.evaluate(() => window.gtag('consent', 'update', { analytics_storage: 'granted' }))
    await s.page.waitForFunction(() => window.dataLayer.some(args => args[1] === 'purchase'))
    assert.equal(await purchaseCount(s.page), 1)
    await s.context.close()
    console.log('PASS: consent denial suppresses event/marker; later grant reports once')
  }
  // Unmount while awaiting verification must not report on a different route.
  {
    const s = await scenario({ responses: [{ status: 'pending' }] })
    await s.page.goto(`${BASE}/checkout/success?order=${id}`)
    await s.page.getByRole('heading', { name: 'PAYMENT PROCESSING' }).waitFor()
    await s.page.goto(`${BASE}/products`)
    await wait(3500)
    assert.equal(s.verifies.length, 1)
    assert.equal(await purchaseCount(s.page), 0)
    await s.context.close()
    console.log('PASS: leaving pending confirmation stops retries and emits no purchase')
  }
} finally { await browser.close() }
