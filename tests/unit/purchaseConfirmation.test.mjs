// Execute the actual confirmation component with an offline React hook harness.
// All external I/O is injected; these are not a substitute for browser QA.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
const root = new URL('../..', import.meta.url).pathname
const compiled = await build({
  entryPoints: [`${root}/src/pages/OrderSuccessPage.jsx`], bundle: true, write: false,
  platform: 'node', format: 'cjs', plugins: [{ name: 'offline', setup(b) {
    b.onResolve({ filter: /^(react|react-router-dom)$|lib\/(supabase|checkoutPayment|purchaseAnalytics)$|stores\/cartStore$|components\/common\/SEOHead$/ }, args => ({ path: args.path, namespace: 'fixtures' }))
    b.onLoad({ filter: /.*/, namespace: 'fixtures' }, ({ path }) => ({ loader: 'js', contents:
      path === 'react' ? 'export default h.react; export const useState=h.react.useState, useEffect=h.react.useEffect;' :
      path === 'react-router-dom' ? 'export const Link="a"; export function useSearchParams(){return [h.params]}' :
      path.includes('checkoutPayment') ? 'export const getCheckoutPayment=h.getPayment, verifyCheckoutPayment=h.verify, clearPurchasedCart=h.clear;' :
      path.includes('purchaseAnalytics') ? 'export const reportPurchase=h.report;' :
      path.includes('supabase') ? 'export const supabase=h.supabase;' :
      path.includes('cartStore') ? 'export const formatPrice=n=>`$${n/100}`; export const useCartStore=h.store;' :
      'export default "seo";',
    }))
  } }],
})
const id = '00000000-0000-4000-8000-000000000001'
const paid = { status: 'paid', order: { total_cents: 3000 }, purchase: { transaction_id: id } }
function harness({ payment = true, results = [paid], updateThrows = false } = {}) {
  const state = [], effects = [], pending = [], timers = new Map(), writes = [], reports = [], checks = []
  let index = 0, dirty = true, tree, nextTimer = 0
  const clearCart = () => {}
  const h = {
    params: new URLSearchParams(`order=${id}&redirect_status=succeeded`),
    getPayment: () => payment ? { clientSecret: 'pi_fixture_secret_fixture' } : null,
    verify: async (...args) => {
      checks.push(args)
      const result = results[Math.min(checks.length - 1, results.length - 1)]
      if (result instanceof Error) throw result
      return await result
    },
    clear() {}, store: selector => selector({ clearCart }),
    report: async purchase => { reports.push(purchase); return 'queued' },
    supabase: { from: () => ({ update: data => ({ neq: () => ({ eq: async () => { writes.push(data); if (updateThrows) throw new Error('offline') } }) }) }) },
    react: {
      createElement: (type, props, ...children) => ({ type, props, children }),
      useState: initial => {
        const slot = index++
        if (!(slot in state)) state[slot] = initial
        return [state[slot], value => { const next = typeof value === 'function' ? value(state[slot]) : value; if (next !== state[slot]) { state[slot] = next; dirty = true } }]
      },
      useEffect: (fn, deps) => {
        const slot = index++, previous = effects[slot]
        if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
          previous?.cleanup?.()
          const effect = { deps }; effects[slot] = effect
          pending.push(() => { effect.cleanup = fn() })
        }
      },
    },
  }
  h.store.getState = () => ({ items: [] })
  const module = { exports: {} }
  runInNewContext(compiled.outputFiles[0].text, { h, module, exports: module.exports, AbortController, Date,
    setTimeout: fn => { const timer = ++nextTimer; timers.set(timer, fn); return timer }, clearTimeout: timer => timers.delete(timer) })
  const Component = module.exports.default
  const flush = async () => {
    for (let i = 0; i < 25; i++) {
      if (dirty) { dirty = false; index = 0; tree = Component(); pending.splice(0).forEach(fn => fn()) }
      await Promise.resolve()
    }
  }
  return { checks, writes, reports, flush, text: () => JSON.stringify(tree),
    tick: async () => { const [timer, fn] = timers.entries().next().value; timers.delete(timer); fn(); await flush() },
    dispose: () => effects.forEach(e => e?.cleanup?.()),
  }
}

test('forged success flag without checkout capability never verifies, writes paid or reports', async () => {
  const h = harness({ payment: false }); await h.flush()
  assert.match(h.text(), /PAYMENT NOT YET VERIFIED/)
  assert.equal(h.checks.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.reports.length, 0)
  h.dispose()
})

test('pending becomes paid only after server verification, then fulfillment fallback and analytics run', async () => {
  const h = harness({ results: [{ status: 'pending' }, paid] }); await h.flush()
  assert.match(h.text(), /PAYMENT PROCESSING/)
  assert.equal(h.writes.length, 0); assert.equal(h.reports.length, 0)
  await h.tick()
  assert.match(h.text(), /CONFIRMED!/)
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].payment_status, 'paid')
  assert.equal(h.reports.length, 1)
  h.dispose()
})

test('failed and verification-error states never mark paid, show confirmed, or report', async () => {
  for (const result of [{ status: 'failed' }, new Error('offline')]) {
    const h = harness({ results: [result] }); await h.flush()
    assert.doesNotMatch(h.text(), /CONFIRMED!/)
    assert.equal(h.writes.length, 0); assert.equal(h.reports.length, 0)
    h.dispose()
  }
})

test('late response after navigation/unmount cannot update fulfillment or analytics', async () => {
  let resolve
  const h = harness({ results: [new Promise(r => { resolve = r })] }); await h.flush()
  h.dispose(); resolve(paid); await h.flush()
  assert.equal(h.writes.length, 0); assert.equal(h.reports.length, 0)
})

test('fulfilled payment remains confirmed if the independent fallback update fails', async () => {
  const h = harness({ updateThrows: true }); await h.flush()
  assert.match(h.text(), /CONFIRMED!/)
  assert.equal(h.reports.length, 1)
  h.dispose()
})

test('verified legacy/test payment can confirm without analytics payload', async () => {
  const h = harness({ results: [{ ...paid, purchase: null }] }); await h.flush()
  assert.match(h.text(), /CONFIRMED!/)
  assert.equal(h.writes.length, 1); assert.equal(h.reports.length, 0)
  h.dispose()
})
