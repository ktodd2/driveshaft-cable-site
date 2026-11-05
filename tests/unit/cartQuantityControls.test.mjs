import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Exercise the actual rendered buttons and cart actions; only network, SEO
// and navigation use fixtures. No orders or payment requests are submitted.
const require = createRequire(import.meta.url)
const root = new URL('../..', import.meta.url).pathname
const compiled = await build({
  stdin: { contents: `export * from './src/stores/cartStore.js'; export { default as Cart } from './src/pages/CartPage.jsx'`, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'cart-fixtures', setup(b) {
    b.onResolve({ filter: /(?:lib\/supabase|common\/SEOHead|^react-router-dom$)/ }, args => ({ path: args.path, namespace: 'fixtures' }))
    b.onLoad({ filter: /.*/, namespace: 'fixtures' }, ({ path }) => ({ loader: 'js', resolveDir: root, contents:
      path.includes('supabase') ? `export const supabase = { from() { const q = { select() { return q }, then(resolve) { return Promise.resolve({ data: testData.sales }).then(resolve) } }; return q } }` :
      path.includes('SEOHead') ? `export default function SEOHead() { return null }` :
      `import React from 'react'; export function useNavigate() { return path => testData.navigation = path } export function Link({ to, children, ...props }) { return React.createElement('a', { ...props, href: to }, children) }`,
    }))
  } }],
})
const cable = { id: '1', name: 'Driveshaft Cable', slug: 'driveshaft-cable', base_price_cents: 300, min_order_quantity: 10, order_quantity_step: 10, tiers: [{ min: 50, price: 290 }, { min: 100, price: 270 }, { min: 200, price: 245 }] }
const xl = { ...cable, id: 'xl', name: 'Driveshaft Cable XL', slug: 'driveshaft-cable-xl', base_price_cents: 500, tiers: [{ min: 50, price: 483 }, { min: 100, price: 450 }, { min: 200, price: 408 }] }
const cutter = { id: 'cutter', name: 'Driveshaft Cable Cutters', slug: 'driveshaft-cable-cutters', base_price_cents: 2500, min_order_quantity: 1, order_quantity_step: 1, tiers: [] }
const bolts = { ...cutter, id: '3', name: 'Value Brake Caging Bolt (10-Pack)', slug: 'value-brake-caging-bolt', base_price_cents: 2199 }
function harness() {
  const saved = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } })
  const testData = { sales: [] }, module = { exports: {} }
  runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require, testData, console, setTimeout() {}, setInterval() {}, clearInterval() {} })
  const s = module.exports, store = s.useCartStore
  store.getState().hydrateStorefrontProducts([cable, xl, cutter, bolts])
  function view() {
    // Zustand's server snapshot must reflect the state being rendered.
    Object.assign(store.getInitialState(), store.getState())
    let tree
    function Capture() { tree = s.Cart(); return tree }
    const html = renderToStaticMarkup(React.createElement(Capture))
    const buttons = []
    function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!React.isValidElement(node)) return
      if (node.type === 'button') buttons.push(node.props)
      walk(node.props.children)
    }
    walk(tree)
    return { html, button: label => {
      const found = buttons.find(b => b['aria-label'] === label || b.children === label)
      assert.ok(found, `Missing button: ${label}`)
      return found
    } }
  }
  return { ...s, store, view, saved, testData, add: (p, qty, opts) => store.getState().addItem({ ...p, price_cents: p.base_price_cents }, qty, opts) }
}
const increase = p => `Increase ${p.name} quantity by ${p.order_quantity_step}`
const decrease = p => `Decrease ${p.name} quantity by ${p.order_quantity_step}`
const quantity = (s, p) => s.store.getState().items.find(i => i.productId === p.id)?.quantity
function totals(s, subtotal, shipping) {
  const state = s.store.getState()
  assert.equal(s.selectSubtotal(state), subtotal)
  assert.equal(s.selectShipping(state), shipping)
  assert.equal(s.selectOrderTotal(state), subtotal + shipping)
  const html = s.view().html
  assert.ok(html.includes(s.formatPrice(subtotal)))
  assert.ok(html.includes(s.formatPrice(subtotal + shipping)))
}

test('cart buttons update line pricing and totals across tiers, even before a rerender', () => {
  const s = harness(); s.add(cable, 10)
  const plus = s.view().button(increase(cable))
  for (let i = 0; i < 4; i++) plus.onClick()
  assert.equal(quantity(s, cable), 50)
  assert.equal(s.getPriceForQuantity(cable.id, 50), 290)
  totals(s, 14500, 2000)
  assert.match(s.view().html, /data-testid="cart-line-total">\$145\.00/)
  s.view().button(decrease(cable)).onClick()
  assert.equal(quantity(s, cable), 40)
  totals(s, 12000, 2000)
})

test('minimum disables subtract, guards stale clicks and preserves low-stock exceptions', () => {
  for (const p of [cable, xl, cutter, bolts]) {
    const s = harness(); s.add(p, p.min_order_quantity)
    const minus = s.view().button(decrease(p))
    assert.equal(minus.disabled, true)
    minus.onClick()
    assert.equal(quantity(s, p), p.min_order_quantity)
    s.view().button(increase(p)).onClick()
    const enabled = s.view().button(decrease(p)); assert.equal(enabled.disabled, false)
    enabled.onClick(); enabled.onClick()
    assert.equal(quantity(s, p), p.min_order_quantity)
  }
  const s = harness(); s.add(cable, 5, { reducedMinimum: true })
  assert.equal(s.view().button(decrease(cable)).disabled, true)
  s.view().button(increase(cable)).onClick()
  assert.equal(quantity(s, cable), 15)
  s.view().button(decrease(cable)).onClick()
  assert.equal(quantity(s, cable), 5)
  assert.equal(s.selectMeetsMinimum(s.store.getState()), true)
})

test('mixed cart recalculates free shipping in both directions and leaves other lines intact', () => {
  const s = harness(); s.add(cable, 200); s.add(xl, 20); s.add(cutter, 1)
  totals(s, 61500, 0)
  s.view().button(decrease(xl)).onClick()
  totals(s, 56500, 2000)
  s.view().button(increase(xl)).onClick()
  totals(s, 61500, 0)
  assert.equal(quantity(s, cable), 200)
  s.view().button(increase(cutter)).onClick()
  assert.equal(quantity(s, cutter), 2)
  totals(s, 64000, 0)
})

test('sales apply after tier changes, and quantity edits retain recovery coupons and saved carts', async () => {
  const s = harness(); s.add(cable, 40); s.add(bolts, 1)
  s.store.setState({ recoveryDiscountCode: 'saved-recovery-code', recoveryEmail: 'test@example.invalid' })
  s.testData.sales = [{ id: 'fixture', name: 'Fixture sale', is_active: true, scope: 'sitewide', discount_percent: 10, starts_at: '2000-01-01', ends_at: '2999-01-01' }]
  await s.store.getState().loadSales()
  s.view().button(increase(cable)).onClick()
  totals(s, 13050 + 1979, 2000)
  assert.equal(s.getPriceForQuantity(cable.id, 50), 261)
  const saved = JSON.parse(s.saved.get('ktodd-cart')).state
  assert.equal(saved.items.find(i => i.productId === cable.id).quantity, 50)
  assert.equal(saved.recoveryDiscountCode, 'saved-recovery-code')
  s.store.setState({ items: [] }); s.saved.set('ktodd-cart', JSON.stringify({ state: saved, version: 0 }))
  await s.store.persist.rehydrate()
  assert.equal(quantity(s, cable), 50)
  assert.equal(s.store.getState().recoveryDiscountCode, 'saved-recovery-code')
})

test('remove, checkout navigation and clear cart remain available after quantity edits', () => {
  const s = harness(); s.add(cable, 10); s.add(bolts, 1)
  s.view().button(increase(bolts)).onClick()
  assert.equal(quantity(s, bolts), 2)
  s.view().button(`Remove ${bolts.name} from cart`).onClick()
  assert.equal(quantity(s, bolts), undefined)
  s.view().button('Proceed to Checkout').onClick()
  assert.equal(s.testData.navigation, '/checkout')
  s.view().button('Clear Cart').onClick()
  assert.equal(s.store.getState().items.length, 0)
  assert.match(s.view().html, /YOUR CART IS EMPTY/)
})
