// Route inventory coverage, verified by code: every <Route> in src/App.jsx must
// appear in docs/design-refresh/route-inventory.json with sample URLs and a
// non-pending work + test status.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { discoverRoutes, checkCoverage, INVENTORY_PATH, categorize } from '../../scripts/route-inventory.mjs'

const appSource = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8')

test('route discovery parses layout-nested, redirect, wildcard and lazy admin routes', () => {
  const routes = discoverRoutes(appSource)
  const paths = routes.map((r) => r.path)
  assert.ok(paths.includes('/'), 'index route')
  assert.ok(paths.includes('/products/:slug'))
  assert.ok(paths.includes('/blog/:slug'))
  assert.ok(paths.includes('/cart/recover/:token'))
  assert.ok(paths.includes('/*'), 'wildcard 404')
  assert.ok(paths.includes('/admin/login'))
  assert.equal(routes.find((r) => r.path === '/products/driveshaft-cable-plus').redirectTo, '/products/driveshaft-cable')
  assert.equal(routes.find((r) => r.path === '/admin/orders').module, './pages/admin/AdminOrdersPage')
  assert.equal(new Set(paths).size, paths.length, 'no duplicates')
  // Every route element resolves to a module (except redirects).
  for (const r of routes) if (!r.redirectTo) assert.ok(r.module, `module for ${r.path}`)
})

test('synthetic source: nested children resolve relative to their layout', () => {
  const src = `import A from './A'\nconst B = React.lazy(() => import('./B'))\n<Routes><Route path="/" element={<L />}><Route index element={<A />} /><Route path="x/:id" element={<A />} /></Route><Route path="/admin" element={<Suspense fallback={<div />}><B /></Suspense>} /></Routes>`
  const routes = discoverRoutes(src)
  assert.deepEqual(routes.map((r) => r.path), ['/', '/x/:id', '/admin'])
  assert.equal(routes[2].module, './B')
  assert.equal(routes[2].lazy, true)
})

test('categories cover admin/auth/error/commerce/dynamic', () => {
  assert.equal(categorize('/admin/login'), 'auth')
  assert.equal(categorize('/admin/sales'), 'admin')
  assert.equal(categorize('/*'), 'error')
  assert.equal(categorize('/checkout/success'), 'commerce')
  assert.equal(categorize('/blog/:slug'), 'dynamic')
})

test('persisted inventory covers every declared route with work + test status', () => {
  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'))
  const problems = checkCoverage(discoverRoutes(appSource), inventory)
  assert.deepEqual(problems, [])
})
