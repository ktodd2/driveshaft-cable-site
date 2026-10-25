import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Purchase-clarity tests for the Standard / XL cable pages. The real cart
// store, helpers, components and ProductDetailPage are bundled; only network
// hooks, routing, SEO head and Supabase are replaced by fixtures. Fixture
// prices below are TEST DATA mirroring the catalog shape, not app constants.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } })
const require = createRequire(import.meta.url)
const root = new URL('../..', import.meta.url).pathname
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

const compiled = await build({
  stdin: {
    contents: `
      export * from './src/stores/cartStore.js'
      export * from './src/lib/cablePurchase.js'
      export * from './src/components/product/CablePurchase.jsx'
      export { default as Page } from './src/pages/ProductDetailPage.jsx'
    `,
    resolveDir: root,
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'test-fixtures', setup(b) {
    b.onResolve({ filter: /(?:lib\/supabase|hooks\/useStorefrontProducts?|hooks\/useInventory|^react-router-dom$|components\/common\/SEOHead)/ }, args => ({ path: args.path, namespace: 'fixtures' }))
    b.onLoad({ filter: /.*/, namespace: 'fixtures' }, ({ path }) => ({ resolveDir: root, loader: 'js', contents:
      path.includes('supabase') ? `export const supabase = { from(table) { const q = { select() { return q }, eq() { return q }, then(resolve) { return Promise.resolve(table === 'sales' ? { data: testData.sales || [] } : { data: testData.products }).then(resolve) } }; return q } }` :
      path.includes('useStorefrontProducts') ? `export function useStorefrontProducts() { return { products: testData.products, loading: false } }` :
      path.includes('useStorefrontProduct') ? `export function useStorefrontProduct() { return { product: testData.product, loading: false, notFound: !testData.product } }` :
      path.includes('useInventory') ? `export function useInventory() { return { stock: 9999, totalStock: 9999, loading: false } }` :
      path.includes('SEOHead') ? `export default function SEOHead() { return null }` :
      `import React from 'react'
       export function Link({ to, children, ...props }) { return React.createElement('a', { ...props, href: to }, children) }
       export function useParams() { return { slug: testData.product && testData.product.slug } }
       export function useNavigate() { return () => {} }` }))
  } }],
})

const standard = {
  id: '1', slug: 'driveshaft-cable', name: 'Driveshaft Cable', sku: 'KTDC-001', base_price_cents: 300, min_order_quantity: 10, order_quantity_step: 10,
  tiers: [{ min: 50, price: 290 }, { min: 100, price: 270 }, { min: 200, price: 245 }],
  specs: { 'Total Length': '1000mm (39")', 'Cable Diameter': '5/32" (4mm)', 'Cable Material': 'Galvanized Steel Wire', 'Coupler Material': 'Yellow Anodized Aluminum' },
  features: [], applications: [], images: [],
}
const xl = {
  id: 'driveshaft-cable-xl', slug: 'driveshaft-cable-xl', name: 'Driveshaft Cable XL', sku: 'KTDC-XL-001', base_price_cents: 500, min_order_quantity: 10, order_quantity_step: 10,
  tiers: [{ min: 50, price: 483 }, { min: 100, price: 450 }, { min: 200, price: 408 }],
  specs: { Length: '60 inches', 'Body color': 'Green', 'Cable diameter': '5/32 inch' },
  features: [], applications: [], images: [],
}
const cutter = {
  id: 'driveshaft-cable-cutters', slug: 'driveshaft-cable-cutters', name: 'Driveshaft Cable Cutters', sku: 'CUT-1', base_price_cents: 2500, min_order_quantity: 1, order_quantity_step: 1, tiers: [],
  specs: { Material: 'Steel' }, features: [], applications: [], images: [],
}
const saleOn = (extra = {}) => ({ id: 'test-only-sale', name: 'TEST MOCK SALE', is_active: true, scope: 'sitewide', product_id: null, discount_percent: 10, starts_at: '2000-01-01T00:00:00Z', ends_at: '2999-01-01T00:00:00Z', ...extra })

function harness({ product = standard, products = [standard, xl], sales = [] } = {}) {
  const testData = { product, products, sales }
  const module = { exports: {} }
  runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require, testData, console: { warn() {}, error() {} }, setTimeout() {}, setInterval() { return 0 }, clearInterval() {}, Date, Math, Intl })
  return { ...module.exports, testData }
}
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const anchor = (html, id) => (html.match(new RegExp(`<a [^>]*data-testid="${id}"[^>]*>`)) || [''])[0]
const plain = value => JSON.parse(JSON.stringify(value))
const render = (s, el) => renderToStaticMarkup(el)

// ---------------------------------------------------------------- sources
test('source rules the copy relies on: shipping, discount stacking, loyalty percent', () => {
  const store = read('src/stores/cartStore.js')
  assert.match(store, /SHIPPING_FEE = 2000/)
  assert.match(store, /FREE_SHIPPING_THRESHOLD = 60000/)
  assert.match(store, /subtotal >= FREE_SHIPPING_THRESHOLD \? 0 : SHIPPING_FEE/)
  assert.match(store, /REPEAT_CUSTOMER_DISCOUNT = 0\.10/)
  const server = read('supabase/functions/_shared/pricing.ts')
  assert.match(server, /SHIPPING_FEE = 2000/)
  assert.match(server, /FREE_SHIPPING_THRESHOLD = 60000/)
  assert.match(server, /subtotalCents >= FREE_SHIPPING_THRESHOLD \? 0 : SHIPPING_FEE/)
  // Shipping is computed from the merchandise subtotal, before the discount.
  const checkout = read('src/pages/CheckoutPage.jsx')
  assert.match(checkout, /loyaltyDiscountCents = isRepeatCustomer \? Math\.round\(subtotal \* REPEAT_CUSTOMER_DISCOUNT\)/)
  assert.match(checkout, /discountCents = Math\.max\(loyaltyDiscountCents, codeDiscountCents\)/)
  assert.match(checkout, /totalCents = baseTotal - discountCents \+ taxCents/)
  const intent = read('supabase/functions/create-payment-intent/index.ts')
  assert.match(intent, /shippingCents = computeShipping\(subtotalCents\)/)
  assert.match(intent, /discountCents = Math\.max\(loyaltyDiscountCents, codeDiscountCents\)/)
  const discounts = read('supabase/functions/_shared/discounts.ts')
  assert.match(discounts, /\.eq\('payment_status', 'paid'\)/)
})

test('new source files contain no hardcoded prices or catalog price constants', () => {
  for (const file of ['src/lib/cablePurchase.js', 'src/components/product/CablePurchase.jsx']) {
    const src = read(file)
    assert.doesNotMatch(src.replace(/\$\{/g, ''), /\$\d/, `${file} has a literal dollar amount`)
    assert.doesNotMatch(src, /\b(2000|60000|483|450|408|290|270|245)\b/, `${file} has a price/threshold literal`)
  }
})

// --------------------------------------------------------------- shipping
test('shipping is $20 below, free at exactly, and free above the threshold', () => {
  const s = harness()
  const store = s.useCartStore
  for (const [cents, free] of [[59999, false], [60000, true], [60001, true]]) {
    const row = { id: `ship-${cents}`, slug: `ship-${cents}`, name: 'x', base_price_cents: cents, min_order_quantity: 1, order_quantity_step: 1, tiers: [] }
    store.getState().clearCart()
    store.getState().hydrateStorefrontProducts([row])
    store.getState().addItem({ ...row, price_cents: cents }, 1)
    const fromStore = s.selectShipping(store.getState())
    const fromHelper = s.shippingForMerchandise(cents)
    assert.equal(fromStore, free ? 0 : 2000, `store @${cents}`)
    assert.equal(fromHelper.shippingCents, fromStore, `helper agrees with store @${cents}`)
    assert.equal(fromHelper.free, free)
    assert.equal(fromHelper.remainingCents, free ? 0 : 60000 - cents)
  }
})

test('summary shipping text switches exactly at the threshold', () => {
  const s = harness()
  const sel = (merchandiseCents) => ({ quantity: 10, unitCents: merchandiseCents / 10, tierUnitCents: merchandiseCents / 10, sale: null, merchandiseCents })
  const view = (m) => text(render(s, React.createElement(s.CableOrderSummary, { selection: sel(m), minQuantity: 10, step: 10 })))
  assert.match(view(59990), /adds \$20\.00 shipping; \$0\.10 more merchandise reaches free shipping/)
  assert.match(view(60000), /This selection alone reaches free shipping/)
  assert.match(view(60010), /This selection alone reaches free shipping/)
  assert.match(view(60000), /Shipping: \$20\.00 per order, free when the merchandise subtotal is \$600\.00 or more/)
})

// ------------------------------------------------- quantity / tier updates
test('selected-quantity price and total follow the row tiers for both cables', () => {
  const s = harness()
  for (const [row, table] of [[standard, [[10, 300], [49, 300], [50, 290], [100, 270], [200, 245]]], [xl, [[10, 500], [50, 483], [100, 450], [200, 408]]]]) {
    for (const [qty, unit] of table) {
      const sel = s.cableSelectionPricing(row, qty)
      assert.equal(sel.unitCents, unit, `${row.slug} @${qty}`)
      assert.equal(sel.merchandiseCents, unit * qty)
      assert.equal(sel.sale, null)
      const html = text(render(s, React.createElement(s.CableOrderSummary, { selection: sel, minQuantity: 10, step: 10 })))
      assert.ok(html.includes(`${qty} × ${s.formatPrice(unit)}/ea`), html)
      assert.ok(html.includes(`Merchandise total: ${s.formatPrice(unit * qty)}`), html)
    }
  }
})

test('XL pricing never falls back to the legacy product-1/2 schedule, even before catalog load', () => {
  const s = harness()
  assert.equal(s.getLivePricing()['driveshaft-cable-xl'], undefined)
  assert.equal(s.cableSelectionPricing(xl, 10).unitCents, 500)
  assert.equal(s.cableSelectionPricing(xl, 200).unitCents, 408)
  assert.notEqual(s.cableSelectionPricing(xl, 10).unitCents, 350)
})

test('summary shows minimum and increment from the product, and omits step text when step is 1', () => {
  const s = harness()
  const sel = s.cableSelectionPricing(standard, 30)
  const a = text(render(s, React.createElement(s.CableOrderSummary, { selection: sel, minQuantity: 10, step: 10 })))
  assert.match(a, /Selected: 30 cables · minimum 10, in increments of 10/)
  const b = text(render(s, React.createElement(s.CableOrderSummary, { selection: sel, minQuantity: 5, step: 1 })))
  assert.match(b, /minimum 5(?!, in increments)/)
})

// ------------------------------------------------------------- sales off/on
test('sales off then on: unit price, was-price, total and sale line update', async () => {
  const s = harness()
  const store = s.useCartStore
  let sel = s.cableSelectionPricing(standard, 50)
  assert.deepEqual(plain([sel.unitCents, sel.tierUnitCents, sel.sale]), [290, 290, null])
  let html = text(render(s, React.createElement(s.CableOrderSummary, { selection: sel, minQuantity: 10, step: 10 })))
  assert.doesNotMatch(html, /was \$|Includes /)

  s.testData.sales = [saleOn()]
  await store.getState().loadSales()
  sel = s.cableSelectionPricing(standard, 50)
  assert.deepEqual(plain([sel.unitCents, sel.tierUnitCents, sel.sale.percent]), [261, 290, 10])
  assert.equal(sel.merchandiseCents, 261 * 50)
  html = text(render(s, React.createElement(s.CableOrderSummary, { selection: sel, minQuantity: 10, step: 10 })))
  assert.match(html, /50 × \$2\.61\/ea \(was \$2\.90\/ea\)/)
  assert.match(html, /Merchandise total: \$130\.50/)
  assert.match(html, /Includes TEST MOCK SALE \(−10%\), applied after volume pricing/)
  // XL gets the sitewide sale too, applied after its own tier.
  assert.equal(s.cableSelectionPricing(xl, 100).unitCents, Math.round(450 * 0.9))

  // Best sale wins; inactive/expired/not-started/other-product sales are ignored.
  s.testData.sales = [
    saleOn({ id: 'a', name: 'Small', discount_percent: 5 }),
    saleOn({ id: 'b', name: 'Big', discount_percent: 20 }),
    saleOn({ id: 'c', name: 'Off', discount_percent: 50, is_active: false }),
    saleOn({ id: 'd', name: 'Expired', discount_percent: 60, ends_at: '2001-01-01T00:00:00Z' }),
    saleOn({ id: 'e', name: 'Future', discount_percent: 70, starts_at: '2998-01-01T00:00:00Z' }),
    saleOn({ id: 'f', name: 'Other', discount_percent: 80, scope: 'product', product_id: 'something-else' }),
  ]
  await store.getState().loadSales()
  assert.equal(s.cableSelectionPricing(standard, 10).sale.name, 'Big')
  assert.equal(s.cableSelectionPricing(standard, 10).unitCents, 240)

  s.testData.sales = []
  await store.getState().loadSales()
  assert.equal(s.cableSelectionPricing(standard, 10).sale, null)
  assert.equal(s.cableSelectionPricing(standard, 10).unitCents, 300)
})

// ----------------------------------------------------------- comparison
test('comparison is built from catalog specs for both routes with direct links', () => {
  const s = harness()
  const c = s.buildCableComparison([cutter, xl, standard])
  assert.deepEqual(plain(c.entries.map(e => e.slug)), ['driveshaft-cable', 'driveshaft-cable-xl'])
  assert.equal('lengthDifferenceInches' in c, false)
  const [a, b] = c.entries
  assert.equal(a.length, '1000mm (39")')
  assert.equal(b.length, '60 inches')
  assert.equal('lengthInches' in a || 'lengthInches' in b, false)
  assert.deepEqual(plain([a.length, a.diameter, a.appearance]), ['1000mm (39")', '5/32" (4mm)', 'Yellow anodized aluminum couplers'])
  assert.deepEqual(plain([b.length, b.diameter, b.appearance]), ['60 inches', '5/32 inch', 'Green body'])
  assert.deepEqual(plain([a.href, b.href]), ['/products/driveshaft-cable', '/products/driveshaft-cable-xl'])
})

test('comparison renders both links on both pages, marks the current one, and gives measurement guidance', () => {
  const s = harness()
  const comparison = s.buildCableComparison([standard, xl])
  for (const current of ['driveshaft-cable', 'driveshaft-cable-xl']) {
    const html = render(s, React.createElement(s.CableComparison, { comparison, currentSlug: current }))
    for (const href of ['/products/driveshaft-cable', '/products/driveshaft-cable-xl']) {
      assert.ok(html.includes(`href="${href}"`), `${current}: missing ${href}`)
    }
    const other = current === 'driveshaft-cable' ? 'driveshaft-cable-xl' : 'driveshaft-cable'
    assert.match(anchor(html, `compare-link-${current}`), /aria-current="page"/)
    assert.doesNotMatch(anchor(html, `compare-link-${other}`), /aria-current/)
    const t = text(html)
    assert.match(t, /Choose by measurement/)
    assert.doesNotMatch(t, /\blonger\b|\bshorter\b|\d+\s*inches? (?:more|less|difference)/i)
    assert.doesNotMatch(t, /\b21\b/)
    assert.match(t, /we don't list vehicle-specific fitment/)
    assert.match(t, /1000mm \(39"\)/)
    assert.match(t, /60 inches/)
    assert.match(t, /Yellow anodized aluminum couplers/)
    assert.match(t, /Green body/)
    assert.match(t, /Price at 10 \$3\.00\/ea/)
    assert.match(t, /Price at 10 \$5\.00\/ea/)
    assert.doesNotMatch(t, /\bsafe(?:ty)?\b|\bfits?\b|guarantee|stronger|strongest/i)
  }
})

test('comparison disappears (never half-renders) when a cable row is missing', () => {
  const s = harness()
  assert.equal(s.buildCableComparison([standard]), null)
  assert.equal(s.buildCableComparison([]), null)
  assert.equal(s.buildCableComparison(undefined), null)
  assert.equal(render(s, React.createElement(s.CableComparison, { comparison: null, currentSlug: 'driveshaft-cable' })), '')
})

test('comparison reflects the sale when one is active (labeled as sale price)', async () => {
  const s = harness()
  s.testData.sales = [saleOn()]
  await s.useCartStore.getState().loadSales()
  const t = text(render(s, React.createElement(s.CableComparison, { comparison: s.buildCableComparison([standard, xl]), currentSlug: 'driveshaft-cable' })))
  assert.match(t, /Price at 10 \$2\.70\/ea \(sale price\)/)
  assert.match(t, /Price at 10 \$4\.50\/ea \(sale price\)/)
})

// --------------------------------------------------------------- page level
test('both cable pages render positioning, summary, returning note and comparison', () => {
  for (const row of [standard, xl]) {
    const s = harness({ product: row })
    const html = render(s, React.createElement(s.Page))
    const t = text(html)
    for (const id of ['cable-positioning', 'cable-order-summary', 'cable-returning-note', 'cable-comparison']) {
      assert.ok(html.includes(`data-testid="${id}"`), `${row.slug} missing ${id}`)
    }
    assert.match(t, /professional heavy-duty towing and recovery operations/)
    assert.match(t, /Available in two lengths/)
    assert.ok(html.includes('href="/products/driveshaft-cable"') && html.includes('href="/products/driveshaft-cable-xl"'))
    assert.match(t, /Returning customers save an extra 10% on the merchandise subtotal/)
    assert.match(t, /Discount codes can't be combined with it; the larger discount applies/)
    assert.match(t, /Tax is calculated at checkout/)
    assert.match(t, /Quantity \(min\. 10, in increments of 10\)/)
    // Single total, directly above the buttons; the old inline "Total:" is gone.
    assert.doesNotMatch(t, /\bTotal: \$/)
    assert.ok(html.indexOf('data-testid="cable-order-summary"') < html.indexOf('Add to Cart'))
    const unit = row.base_price_cents
    assert.ok(t.includes(`10 × ${s.formatPrice(unit)}/ea`), t)
    assert.ok(t.includes(`Merchandise total: ${s.formatPrice(unit * 10)}`))
  }
  const sx = harness({ product: xl })
  const xlPage = text(render(sx, React.createElement(sx.Page)))
  const beforeComparison = xlPage.slice(0, xlPage.indexOf('STANDARD VS XL'))
  assert.doesNotMatch(beforeComparison, /\$3\.50|\$3\.00/, 'XL purchase area must not show legacy fallback prices')
})

test('page links: positioning links exist without the catalog and the current length is marked', () => {
  const s = harness({ product: xl, products: [] })
  const html = render(s, React.createElement(s.Page))
  assert.ok(html.includes('data-testid="length-link-driveshaft-cable"') && html.includes('data-testid="length-link-driveshaft-cable-xl"'))
  assert.match(anchor(html, 'length-link-driveshaft-cable-xl'), /aria-current="page"/)
  assert.doesNotMatch(anchor(html, 'length-link-driveshaft-cable'), /aria-current/)
  assert.ok(!html.includes('data-testid="cable-comparison"'), 'no half comparison when catalog sibling is missing')
})

test('non-cable pages keep their original rendering with none of the cable additions', () => {
  const s = harness({ product: cutter, products: [standard, xl, cutter] })
  s.useCartStore.getState().hydrateStorefrontProducts([cutter]) // what the app's catalog load does
  const html = render(s, React.createElement(s.Page))
  const t = text(html)
  assert.doesNotMatch(html, /data-testid="cable-|data-testid="length-link|compare-lengths|data-testid="compare-/)
  assert.match(t, /Returning customers save an extra 10% — applied automatically at checkout!/)
  assert.match(t, /Total: \$250\.00/)
  assert.doesNotMatch(t, /Merchandise total|heavy-duty towing|Standard VS XL|Shipping: \$/i)
  // A different slug that merely resembles a cable slug is also excluded.
  const lookalike = { ...cutter, id: 'x', slug: 'driveshaft-cable-xl-extra' }
  const s2 = harness({ product: lookalike })
  assert.doesNotMatch(render(s2, React.createElement(s2.Page)), /data-testid="cable-/)
  assert.equal(s.isCableSlug('driveshaft-cable'), true)
  assert.equal(s.isCableSlug('driveshaft-cable-xl'), true)
  assert.equal(s.isCableSlug('driveshaft-cable-cutters'), false)
  assert.equal(s.isCableSlug('driveshaft-cable-plus'), false)
})

test('sale on: cable page shows strike-through tier price, sale line, and updated total', async () => {
  const s = harness({ product: standard })
  s.testData.sales = [saleOn()]
  await s.useCartStore.getState().loadSales()
  const t = text(render(s, React.createElement(s.Page)))
  assert.match(t, /10 × \$2\.70\/ea \(was \$3\.00\/ea\)/)
  assert.match(t, /Merchandise total: \$27\.00/)
  assert.match(t, /Includes TEST MOCK SALE/)
})
