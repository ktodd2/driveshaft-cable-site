import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const root = new URL('../..', import.meta.url).pathname
const compiled = await build({
  stdin: { contents: `
    export * from './src/stores/cartStore.js'
    export * from './src/lib/checkoutSummary.js'
    export { default as Lines } from './src/components/checkout/CheckoutOrderItems.jsx'
    export { default as Checkout } from './src/pages/CheckoutPage.jsx'
    export { priceCheckout } from './supabase/functions/_shared/checkoutPricing.ts'
  `, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'no-external-effects', setup(b) {
    b.onResolve({ filter: /(?:lib\/supabase$|common\/SEOHead|checkout\/BuyerEmailVerification|^react-router-dom$|^@stripe\/|^https:)/ }, args => ({ path: args.path, namespace: 'fixtures' }))
    b.onLoad({ filter: /.*/, namespace: 'fixtures' }, ({ path }) => ({ loader: 'js', resolveDir: root, contents:
      path.includes('lib/supabase') ? `export const supabase = testData.db` :
      path.startsWith('https:') ? `export const createClient=()=>{throw Error('Network forbidden')}; export default class Stripe {}` :
      path.startsWith('@stripe/') ? `export function loadStripe(){return Promise.resolve(null)}; export function Elements(){return null}; export function PaymentElement(){return null}; export function useStripe(){return null}; export function useElements(){return null}` :
      path === 'react-router-dom' ? `import React from 'react'; export function useNavigate(){return ()=>{}}; export function Link({to,children,...props}){return React.createElement('a',{...props,href:to},children)}` :
      `export default function ExternalUI(){return null}`,
    }))
  } }],
})
const cable = { id: '1', name: 'Driveshaft Cable', slug: 'driveshaft-cable', base_price_cents: 300, min_order_quantity: 10, order_quantity_step: 10, tiers: [{ min: 50, price: 290 }, { min: 100, price: 270 }, { min: 200, price: 245 }] }
const xl = { ...cable, id: 'xl', name: 'Driveshaft Cable XL', slug: 'driveshaft-cable-xl', base_price_cents: 500, tiers: [{ min: 50, price: 483 }, { min: 100, price: 450 }, { min: 200, price: 408 }] }
const cutter = { id: 'cutter', name: 'Cutters', slug: 'driveshaft-cable-cutters', base_price_cents: 2500, min_order_quantity: 1, order_quantity_step: 1, tiers: [] }
const bolts = { ...cutter, id: '3', name: 'Bolt 10-pack', slug: 'value-brake-caging-bolt', base_price_cents: 2199, tiers: [{ min: 5, price: 2099 }, { min: 10, price: 1999 }] }
const sale = { id: 'fixture', name: 'Fixture sale', is_active: true, scope: 'sitewide', discount_percent: 10, starts_at: '2000-01-01', ends_at: '2999-01-01' }
function harness({ repeat = false, sales = [] } = {}) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } })
  const testData = { products: [cable, xl, cutter, bolts].map(p => ({ ...p, is_active: true, is_storefront: true })), sales, repeat, taxCalls: [] }
  testData.db = {
    rpc: async name => { assert.equal(name, 'checkout_repeat_customer'); return { data: testData.repeat } },
    from(table) {
      const filters = new Map()
      const q = {
        select() { return q }, eq(k, v) { filters.set(k, v); return q }, lte() { return q }, gt() { return q },
        single: async () => ({ data: table === 'products' ? testData.products.find(p => p.id === filters.get('id')) : { stock_quantity: 10000 } }),
        maybeSingle: async () => ({ data: null }),
        then(resolve) { assert.equal(table, 'sales'); return Promise.resolve({ data: testData.sales }).then(resolve) },
      }
      return q
    },
  }
  const stripe = { tax: { calculations: { create: async params => { testData.taxCalls.push(params); return { id: 'tax_fixture', tax_amount_exclusive: 123 } } } } }
  const module = { exports: {} }
  runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require, testData, window: { sessionStorage: { getItem: () => null } }, console, setTimeout() {}, clearTimeout() {} })
  const s = module.exports, store = s.useCartStore
  s.seedStorefrontPricing(testData.products, sales)
  const add = (p, qty) => store.getState().addItem({ ...p, price_cents: p.base_price_cents }, qty)
  const items = () => store.getState().items
  const render = (lines = items(), pricesLocked = false) => renderToStaticMarkup(React.createElement(s.Lines, { items: lines, pricesLocked }))
  const quote = async (discountCode = null) => s.priceCheckout(testData.db, stripe, { items: items().map(({ productId, quantity }) => ({ productId, quantity })), customer: { email: 'fixture@invalid.test', address1: '123 Fixture', city: 'Houston', state: 'TX', zip: '77001', country: 'US' }, discountCode })
  return { ...s, store, add, items, render, quote, testData }
}
const amounts = html => [...html.matchAll(/data-testid="checkout-line-total"[^>]*>([^<]+)</g)].map(m => Math.round(Number(m[1].replace(/[$,]/g, '')) * 100))
const plain = value => JSON.parse(JSON.stringify(value))
const response = quote => ({ ...quote, linePrices: quote.lines.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })) })

test('draft checkout line prices match the subtotal at cable and bolt tier thresholds', () => {
  for (const [p, cases] of [[cable, [[40, 300], [50, 290], [90, 290], [100, 270], [190, 270], [200, 245]]], [xl, [[40, 500], [50, 483], [100, 450], [200, 408]]], [bolts, [[4, 2199], [5, 2099], [10, 1999]]]]) {
    for (const [qty, unit] of cases) {
      const s = harness(); s.add(p, qty)
      assert.deepEqual(amounts(s.render()), [qty * unit])
      assert.equal(s.selectSubtotal(s.store.getState()), qty * unit)
      assert.ok(s.render().includes(`${s.formatPrice(unit)}/${p === bolts ? '10-pack' : 'unit'}`))
    }
  }
})

test('the actual shipping-step page displays tiered mixed-product lines rather than stored base prices', () => {
  const s = harness(); s.add(cable, 50); s.add(xl, 110); s.add(cutter, 2); s.add(bolts, 5)
  Object.assign(s.store.getInitialState(), s.store.getState())
  const html = renderToStaticMarkup(React.createElement(s.Checkout))
  assert.deepEqual(amounts(html), [14500, 49500, 5000, 10495])
  assert.equal(amounts(html).reduce((sum, n) => sum + n, 0), s.selectSubtotal(s.store.getState()))
  assert.match(html, /CONTACT INFORMATION/)
  assert.match(html, /5 packs · 50 bolts/)
})

test('server-quoted shipping-step lines override stale client catalog and sale snapshots', async () => {
  const s = harness(); s.add(xl, 110); s.add(cutter, 1)
  // Catalog and sale changed after this browser loaded. The server is authoritative.
  s.testData.products = s.testData.products.map(p => p.id === xl.id ? { ...p, tiers: [{ min: 100, price: 460 }] } : p)
  s.testData.sales = [sale]
  const priced = await s.quote(), quoted = response(priced)
  const lines = s.quotedCheckoutItems(s.items(), quoted)
  assert.deepEqual(amounts(s.render(lines, true)), [45540, 2250])
  assert.equal(amounts(s.render(lines, true)).reduce((sum, n) => sum + n, 0), priced.subtotalCents)
  assert.notDeepEqual(amounts(s.render()), amounts(s.render(lines, true)))
  assert.equal(s.items()[0].price, 500, 'display correction does not rewrite persisted cart base prices')
})

test('sale rounding, coupon/loyalty stacking and tax allocation stay consistent with server pricing', async () => {
  for (const repeat of [false, true]) {
    const s = harness({ repeat, sales: [sale] }); s.add(cable, 200); s.add(xl, 50); s.add(bolts, 5); s.add(cutter, 1)
    const priced = await s.quote('WELCOME5')
    const lines = s.quotedCheckoutItems(s.items(), response(priced))
    assert.deepEqual(amounts(s.render(lines, true)), plain(priced.lines.map(l => l.unitPrice * l.quantity)))
    assert.equal(priced.lines[0].unitPrice, 221, 'round sale unit cents before multiplying')
    assert.equal(priced.discountCents, Math.round(priced.subtotalCents * 0.05) + (repeat ? Math.round(priced.subtotalCents * 0.10) : 0))
    assert.equal(priced.discountSource, repeat ? 'combined' : 'code')
    assert.equal(s.testData.taxCalls[0].line_items.reduce((sum, l) => sum + l.amount, 0), priced.subtotalCents - priced.discountCents)
    assert.equal(priced.totalCents, priced.subtotalCents - priced.discountCents + priced.shippingCents + 123)
    assert.deepEqual(amounts(s.render()), amounts(s.render(lines, true)), 'client and server agree with the same catalog')
  }
})

test('payment and resumed-checkout lines keep frozen server prices after live catalog changes', async () => {
  const s = harness({ sales: [sale] }); s.add(xl, 110); s.add(bolts, 5)
  const priced = await s.quote()
  const snapshot = { items: s.quotedCheckoutItems(s.items(), response(priced)), pricing: priced }
  const before = s.render(snapshot.items, true)
  s.seedStorefrontPricing([{ ...xl, base_price_cents: 9900, tiers: [] }, { ...bolts, base_price_cents: 8800, tiers: [] }], [])
  s.store.getState().clearCart()
  for (const mode of ['payment', 'resume']) {
    const restored = mode === 'resume' ? plain(snapshot) : snapshot
    assert.equal(s.render(restored.items, true), before)
    assert.equal(amounts(s.render(restored.items, true)).reduce((sum, n) => sum + n, 0), restored.pricing.subtotalCents)
  }
})

test('incomplete, stale, duplicate, unsafe or nonreconciling quoted lines fail closed', () => {
  const s = harness(); s.add(cable, 50); s.add(cutter, 1)
  const good = { subtotalCents: 17000, linePrices: [{ productId: '1', quantity: 50, unitPrice: 290 }, { productId: 'cutter', quantity: 1, unitPrice: 2500 }] }
  assert.deepEqual(amounts(s.render(s.quotedCheckoutItems(s.items(), good), true)), [14500, 2500])
  for (const bad of [
    { ...good, linePrices: undefined }, { ...good, linePrices: good.linePrices.slice(1) },
    { ...good, subtotalCents: 17001 }, { ...good, linePrices: [good.linePrices[0], good.linePrices[0]] },
    ...[{ productId: 'unknown' }, { quantity: 40 }, { unitPrice: -1 }, { unitPrice: 2.5 }, { unitPrice: Infinity }, { unitPrice: Number.MAX_SAFE_INTEGER }].map(patch => ({ ...good, linePrices: [{ ...good.linePrices[0], ...patch }, good.linePrices[1]] })),
  ]) assert.throws(() => s.quotedCheckoutItems(s.items(), bad), /quoted item prices/)
})


test('regular product sale stacks with sitewide sale while other products keep only sitewide savings', async () => {
  const s = harness({ repeat: true, sales: [sale, { ...sale, id: 'regular', scope: 'product', product_id: '1' }] })
  s.add(cable, 200); s.add(xl, 50); s.add(cutter, 1)
  const p = await s.quote('WELCOME5')
  assert.equal(p.lines[0].unitPrice, 196)
  assert.equal(p.lines[1].unitPrice, 435)
  assert.equal(p.lines[2].unitPrice, 2250)
  assert.equal(p.discountSource, 'combined')
  assert.equal(s.selectSubtotal(s.store.getState()), p.subtotalCents)
  assert.deepEqual(amounts(s.render()), plain(p.lines.map(l => l.unitPrice * l.quantity)))
  assert.equal(s.testData.taxCalls[0].line_items.reduce((sum,l)=>sum+l.amount,0),p.subtotalCents-p.discountCents)
})
