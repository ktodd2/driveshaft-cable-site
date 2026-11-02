import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const compiled = await build({
  entryPoints: ['src/stores/cartStore.js'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'offline-db', setup(build) {
    build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: 'db', namespace: 'fixture' }))
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const supabase = {}' }))
  } }],
})
const calls = []
const module = { exports: {} }
const browser = { navigator: {}, dataLayer: [], location: { origin: 'https://example.test' }, gtag: (...args) => calls.push(args) }
runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url),
  window: browser, setTimeout: () => 1, console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } })
const { useCartStore, seedStorefrontPricing } = module.exports
const standard = { id: '1', name: 'Cable', base_price_cents: 300, min_order_quantity: 10, order_quantity_step: 10, tiers: [{ min: 50, price: 290 }] }
const bolt = { id: '3', name: 'Bolt pack', base_price_cents: 2199, min_order_quantity: 1, order_quantity_step: 1, tiers: [] }

test('real cart additions report normalized units, the added delta and the resulting tier price', () => {
  seedStorefrontPricing([standard, bolt], [])
  const store = useCartStore.getState()
  store.clearCart()
  calls.length = 0
  store.addItem({ ...standard, price_cents: 300 }, 40)
  store.addItem({ ...standard, price_cents: 300 }, 1) // round to another 10; cross 50-unit tier
  const events = JSON.parse(JSON.stringify(calls))
  assert.equal(events.length, 2)
  assert.equal(events[0][1], 'add_to_cart')
  assert.deepEqual(events[0][2].items, [{ item_id: '1', quantity: 40, price: 3 }])
  assert.deepEqual(events[1][2].items, [{ item_id: '1', quantity: 10, price: 2.9 }])
  assert.equal(events[1][2].value, 29)
  assert.equal(useCartStore.getState().items[0].quantity, 50)
})

test('two bolt packs remain two sellable units and blocked analytics does not stop adding', () => {
  const store = useCartStore.getState()
  store.clearCart()
  calls.length = 0
  store.addItem({ ...bolt, price_cents: 2199 }, 2)
  assert.equal(calls[0][2].items[0].quantity, 2)
  assert.equal(calls[0][2].value, 43.98)
  browser.gtag = () => { throw Error('tag unavailable') }
  assert.doesNotThrow(() => store.addItem({ ...bolt, price_cents: 2199 }, 1))
  assert.equal(useCartStore.getState().items[0].quantity, 3)
})
