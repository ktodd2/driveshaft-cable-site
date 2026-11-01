// Local fixture-only UI test. Set PLAYWRIGHT_MODULE and optional CHROME_EXECUTABLE.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
try {
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
const base = { payment_status: 'paid', status: 'confirmed', name: 'Alex Fixture', created_at: '2026-10-30T12:00:00Z', items: [], total_cents: 5000, email: 'fixture@example.invalid', actual_shipping_cost_cents: null, tracking_number: null }
const orders = [{ ...base, id: 'order-a', actual_shipping_cost_cents: 800, tracking_number: 'OLD' }, { ...base, id: 'order-b', email: 'other@example.invalid' }]
const saved = new Map()
let failSecond = true, rpcCalls = 0, simulatedLostReply = false
await context.addInitScript(() => localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_at: 9999999999, user: { id: 'fixture-admin', email: 'admin@example.invalid' } })))
await page.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (url.port === '4178') return route.continue()
  if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'application/javascript', body: 'window.Stripe = function(){ return {} }' })
  if (url.port !== '9999') return route.abort()
  const table = url.pathname.split('/').pop()
  if (route.request().method() === 'POST') {
    assert.equal(table, 'apply_shipping_import', 'No email or unrelated mutation allowed')
    const payload = route.request().postDataJSON(); rpcCalls++
    if (payload.p_order_id === 'order-b' && failSecond) { failSecond = false; return route.fulfill({ status: 503, json: { message: 'Fixture connection interrupted' } }) }
    const existing = saved.get(payload.p_order_id)
    if (existing) return route.fulfill({ json: { status: 'already_applied', receipt_id: 1 } })
    saved.set(payload.p_order_id, payload)
    const order = orders.find(o => o.id === payload.p_order_id)
    order.actual_shipping_cost_cents = payload.p_labels.reduce((sum,l) => sum + l.cost_cents, 0)
    order.tracking_number = payload.p_tracking
    // Simulate a server commit whose response is lost. Retrying must keep identical keys.
    if (!simulatedLostReply) { simulatedLostReply = true; return route.fulfill({ status: 503, json: { message: 'Fixture response lost after commit' } }) }
    return route.fulfill({ json: { status: 'saved', receipt_id: 2 } })
  }
  assert.ok(['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()))
  let data = []
  if (table === 'orders') data = orders
  if (table === 'shipping_import_receipts') data = [{ id: 1, order_id: 'order-a', created_at: '2026-11-01T00:00:00Z', filename: 'fixture.csv', before_cost: 800, after_cost: 525, before_tracking: 'OLD', after_tracking: 'OLD', labels: [{ cost_cents: 525, source_row: 2, source_key: 'a'.repeat(64), tracking: 'NEW' }] }]
  return route.fulfill({ json: data, headers: { 'content-range': `0-${Math.max(0,data.length-1)}/${data.length}` } })
})
await page.setViewportSize({ width: 1440, height: 1100 })
await page.goto('http://127.0.0.1:4178/admin')
await page.getByRole('button', { name: /BULK SHIPPING IMPORT/ }).click()
const panel = page.locator('section').filter({ has: page.getByRole('button', { name: /BULK SHIPPING IMPORT/ }) })
const upload = async (text, name = 'fixture.csv') => { await panel.getByLabel('Shipping file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) }); await panel.getByRole('button', { name: 'Parse & Preview' }).click() }
await upload('Name,Cost,Tracking Number,Status\nAlex Fixture,5.25,NEW,\nAlex Fixture,0,ZERO,\nNobody,3.00,THIRD,\nAlex Fixture,5.25,NEW,\nAlex Fixture,2.00,VOID,Voided\nBad,garbage,BAD,')
await panel.getByText(/6 source rows/).waitFor()
assert.equal(await panel.getByRole('combobox', { name: /Order for row/ }).count(), 3)
assert.equal(await panel.getByLabel('Order for row 2').inputValue(), '')
await panel.getByLabel('Order for row 2').selectOption('order-a')
await panel.getByLabel('Order for row 3').selectOption('order-a')
await panel.getByLabel('Order for row 4').selectOption('order-b')
const groups = panel.locator('article').filter({ has: page.getByRole('heading', { name: /^Save to/ }) })
assert.equal(await groups.count(), 2)
assert.match(await groups.first().innerText(), /New order total: \$5.25/)
assert.equal(await groups.first().getByRole('combobox').inputValue(), 'OLD')
await groups.first().getByRole('combobox').selectOption('NEW')
assert.match(await groups.first().innerText(), /including replacing existing tracking/)
await groups.first().getByRole('combobox').selectOption('OLD')
for (const g of await groups.all()) await g.getByRole('checkbox').check()
await mkdir('qa/shipping-import', { recursive: true })
await panel.screenshot({ path: 'qa/shipping-import/desktop-review.png', style: 'header { visibility: hidden }' })
await page.setViewportSize({ width: 390, height: 844 })
assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth), 'Importer overflows mobile')
await panel.screenshot({ path: 'qa/shipping-import/mobile-review.png', style: 'header { visibility: hidden }' })
await panel.getByRole('button', { name: /Save confirmed orders/ }).click()
await panel.getByText(/Fixture response lost after commit/).waitFor()
assert.equal(rpcCalls, 1)
await panel.getByRole('button', { name: /Save confirmed orders/ }).click()
await panel.getByText(/Already saved; nothing applied twice/).waitFor()
await panel.getByText(/Fixture connection interrupted/).waitFor()
assert.equal(rpcCalls, 3)
await panel.getByRole('button', { name: /Save confirmed orders/ }).click()
await panel.getByText('Saved cost and tracking. No email sent.').waitFor()
assert.equal(rpcCalls, 4)
assert.equal(saved.get('order-a').p_tracking, 'OLD')
assert.equal(saved.get('order-a').p_labels.length, 2)
assert.equal(await panel.getByRole('button', { name: /Save confirmed orders/ }).isDisabled(), true)
await panel.getByRole('button', { name: 'Load recent saved imports' }).click()
await panel.getByRole('heading', { name: 'Latest 20 saved imports' }).waitFor()
await panel.getByRole('button', { name: /Clear review/ }).click()
assert.equal(await panel.getByRole('combobox', { name: /Order for row/ }).count(), 0)
assert.equal(saved.size, 2, 'Cancel must not undo saves')
await upload('Name,Cost\nAlex Fixture,1')
await panel.getByLabel('Order for row 2').waitFor()
await panel.getByLabel('Order for row 2').selectOption('order-b')
await panel.getByRole('button', { name: /Clear review/ }).click()
assert.equal(rpcCalls, 4, 'Cancel before save must not mutate')
await upload('Name,Cost\n"unclosed,2')
await panel.getByRole('alert').filter({ hasText: /Malformed CSV/ }).waitFor()
await upload('junk', 'bad.xlsx')
await panel.getByRole('alert').waitFor()
await upload('Name,Cost,Tracking Number\n<script>alert(1)</script>,1,SAFE123\nMalicious,1,=1+1')
await panel.getByText(/Invalid tracking number/).waitFor()
assert.equal(await panel.locator('script').count(), 0)
await panel.getByLabel('Shipping file').setInputFiles('tests/fixtures/shipping-import.xlsx')
await panel.getByRole('button', { name: 'Parse & Preview' }).click()
await panel.getByText('Row 2: Alex Fixture — $0.00').waitFor()
await panel.getByText(/0012345678901234567890/).waitFor()
await panel.getByLabel('Order for row 2').selectOption('order-b')
await page.goto('http://127.0.0.1:4178/admin/orders')
await page.goBack()
await page.getByRole('button', { name: /BULK SHIPPING IMPORT/ }).click()
assert.equal(await panel.getByRole('combobox', { name: /Order for row/ }).count(), 0)
assert.equal(rpcCalls, 4)
assert.deepEqual(errors, [])
console.log('Headless desktop/mobile fixture QA passed: explicit ambiguous/manual choices, combined total, tracking conflict/keep, duplicates/voids/errors, lost response, partial retry, cancel, history, malformed CSV/XLSX; only mocked RPC mutations.')
} finally { await browser.close() }
