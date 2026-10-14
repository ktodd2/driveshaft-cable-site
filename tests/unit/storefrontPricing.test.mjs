import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Bundle the actual store and both components. Only external data/stock and
// routing are mocked; pricing, Zustand actions and rendered labels are real.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } })
const require = createRequire(import.meta.url)
const root = new URL('../..', import.meta.url).pathname
const compiled = await build({
  stdin: { contents: `export * from './src/stores/cartStore.js'; export { default as Grid } from './src/components/landing/StorefrontProducts.jsx'; export { default as Showcase } from './src/components/landing/ProductShowcase.jsx';`, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'read-only-fixtures', setup(b) {
    b.onResolve({ filter: /(?:lib\/supabase|hooks\/useStorefrontProducts|hooks\/useInventory|^react-router-dom$)/ }, args => ({ path: args.path, namespace: 'fixtures' }))
    b.onLoad({ filter: /.*/, namespace: 'fixtures' }, ({ path }) => ({ contents:
      path.includes('supabase') ? `export const supabase = { from(table) { const q = { select() { return q }, eq() { return q }, then(resolve) { return Promise.resolve(table === 'sales' ? {data: testData.sales || []} : testData.response).then(resolve) } }; return q } }` :
      path.includes('useStorefrontProducts') ? `export function useStorefrontProducts() { return { products: testData.products, loading: false } }` :
      path.includes('useInventory') ? `export function useInventory() { return { stock: 9999, totalStock: 9999, loading: false } }` :
      `import React from 'react'; export function Link({to, children, ...props}) { return React.createElement('a', {...props, href:to}, children) }`, loader: 'js', resolveDir: root }))
  }}],
})
const cutter = { id: 'driveshaft-cable-cutters', slug: 'driveshaft-cable-cutters', name: 'Driveshaft Cable Cutters', base_price_cents: 2500, min_order_quantity: 1, order_quantity_step: 1, tiers: [] }
const xl = { id: 'driveshaft-cable-xl', name: 'Driveshaft Cable XL', base_price_cents: 500, min_order_quantity: 10, order_quantity_step: 10, tiers: [{ min: 50, price: 483 }, { min: 200, price: 408 }, { min: 100, price: 450 }] }
function harness(products = [cutter, xl]) {
  const testData = { products, response: { error: { message: 'simulated read failure' } } }
  const module = { exports: {} }
  runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require, testData, console: { warn() {}, error() {} }, setTimeout() {} })
  return { ...module.exports, testData }
}
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

test('first-render DB rows override product-1 fallback for every quantity without cart hydration', () => {
  const s = harness()
  assert.equal(s.useCartStore.getState().productsLoadedAt, 0)
  for (const [row, prices] of [[cutter, [[1, 2500], [50, 2500]]], [xl, [[10, 500], [50, 483], [100, 450], [200, 408]]]]) {
    for (const [qty, cents] of prices) {
      assert.equal(s.getPriceForQuantity(row.id, qty, row), cents)
      assert.equal(s.getTierPriceForQuantity(row.id, qty, row), cents)
    }
  }
  const updatedOriginal = { ...xl, id: '1', base_price_cents: 900, tiers: [] }
  assert.equal(s.getPriceForQuantity('1', 200, updatedOriginal), 900, 'even a known static ID uses its DB row')
  assert.equal(s.getPriceForQuantity('new-accessory', 50, { ...cutter, id: 'new-accessory' }), 2500)
})

test('normalization preserves rows and sorts tiers descending with threshold-derived labels', () => {
  const s = harness(), before = JSON.stringify(xl)
  assert.deepEqual(JSON.parse(JSON.stringify(s.normalizeDbProduct(xl).tiers)), [
    { min: 200, price: 408, label: '200+' }, { min: 100, price: 450, label: '100-199' }, { min: 50, price: 483, label: '50-99' },
  ])
  assert.equal(JSON.stringify(xl), before)
})

test('actual grid first render shows cutter base/total without discount and XL own banner', () => {
  const s = harness()
  const html = renderToStaticMarkup(React.createElement(s.Grid))
  const cards = [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(m => text(m[0]))
  assert.match(cards[0], /\$25\.00 per unit/)
  assert.match(cards[0], /Total: \$25\.00/)
  assert.doesNotMatch(cards[0], /discount|\$3\.00/i)
  assert.match(cards[1], /\$5\.00 per unit/)
  assert.match(cards[1], /Total: \$50\.00/)
  assert.doesNotMatch(cards[1], /Volume discount applied/i)
  const banner = text(html.slice(0, html.indexOf('<article')))
  assert.match(banner, /Driveshaft Cable Cutters Per unit: \$25\.00\/ea/)
  assert.match(banner, /Driveshaft Cable XL 10-49: \$5\.00\/ea 50-99: \$4\.83\/ea 100-199: \$4\.50\/ea 200\+: \$4\.08\/ea/)
})

test('actual showcase renders empty-tier cutters safely and XL own bulk minimum', () => {
  const s = harness()
  const html = text(renderToStaticMarkup(React.createElement(s.Showcase)))
  const cutterText = html.split('Driveshaft Cable Cutters')[1].split('Shop')[0]
  assert.match(cutterText, /\$25\.00/)
  assert.doesNotMatch(cutterText, /Bulk|discount|\$3\.00/i)
  assert.match(html, /Driveshaft Cable XL Starting at \$5\.00\s*\/ea Bulk: as low as \$4\.08\/ea/)
})

test('storefront hydration survives cart read failure, preserves unrelated lines, min/step and shipping', async () => {
  const s = harness(), store = s.useCartStore
  store.setState({ items: [{ productId: 'unlisted', quantity: 1 }] })
  store.getState().hydrateStorefrontProducts([cutter, xl])
  const firstRevision = store.getState().productsLoadedAt
  store.getState().hydrateStorefrontProducts([cutter])
  assert.ok(store.getState().productsLoadedAt > firstRevision)
  assert.equal(store.getState().items[0].productId, 'unlisted')
  await store.getState().loadProducts()
  assert.equal(s.getPriceForQuantity(cutter.id, 50), 2500)
  assert.equal(s.getPriceForQuantity(xl.id, 200), 408)
  store.getState().clearCart()
  store.getState().addItem({ ...cutter, price_cents: 2500 }, 1)
  assert.equal(store.getState().items[0].quantity, 1)
  assert.equal(s.selectSubtotal(store.getState()), 2500)
  assert.equal(s.selectShipping(store.getState()), 1500)
  assert.equal(s.selectOrderTotal(store.getState()), 4000)
  assert.equal(s.selectHasBulkDiscount(store.getState()), false)
  store.getState().updateQuantity(cutter.id, 50)
  assert.equal(s.selectSubtotal(store.getState()), 125000)
  assert.equal(s.selectShipping(store.getState()), 0)
  assert.equal(s.selectHasBulkDiscount(store.getState()), false)
  assert.equal(s.getPriceForQuantity('1', 10), 300)
  assert.equal(s.getPriceForQuantity('1', 200), 245)
})

test('a later successful catalog refresh still updates live pricing and existing sales still apply', async () => {
  const s = harness(), store = s.useCartStore
  store.getState().hydrateStorefrontProducts([cutter, xl])
  s.testData.response = { data: [{ ...cutter, base_price_cents: 2600 }, xl] }
  await store.getState().loadProducts()
  assert.equal(s.getPriceForQuantity(cutter.id, 1), 2600)
  assert.equal(s.getPriceForQuantity(cutter.id, 1, cutter), 2500, 'card snapshot is authoritative')
  s.testData.sales = [{ id: 'test-only', name: 'Test sale', is_active: true, scope: 'product', product_id: cutter.id, discount_percent: 10, starts_at: '2000-01-01', ends_at: '2999-01-01' }]
  await store.getState().loadSales()
  assert.equal(s.getTierPriceForQuantity(cutter.id, 1, cutter), 2500)
  assert.equal(s.getPriceForQuantity(cutter.id, 1, cutter), 2250)
  const html = text(renderToStaticMarkup(React.createElement(s.Grid)))
  assert.match(html, /\$25\.00 \$22\.50/)
  assert.match(html, /Test sale/)
  assert.doesNotMatch(html, /Volume discount applied/)
})
