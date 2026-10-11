#!/usr/bin/env node
// Route inventory for the design refresh.
//
// Discovers every <Route> declared in src/App.jsx (no hand-maintained list),
// resolves each element to its page module, attaches the sample URLs and
// UI states that the browser smoke run exercises, and merges per-route
// work/test status into docs/design-refresh/route-inventory.json.
//
//   node scripts/route-inventory.mjs          # regenerate (keeps statuses)
//   node scripts/route-inventory.mjs --check  # exit 1 if any declared route is
//                                             # missing from the inventory or
//                                             # lacks a work/test status
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APP = join(ROOT, 'src/App.jsx')
export const INVENTORY_PATH = join(ROOT, 'docs/design-refresh/route-inventory.json')

// Yield each <Route ...> opening tag with its attribute text. JSX attribute
// values contain `>` (element={<Page />}), so track brace depth instead of
// stopping at the first `>`.
function* scanRouteTags(source) {
  const re = /<Route\b/g
  let m
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length
    let depth = 0
    for (; i < source.length; i++) {
      const ch = source[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
    }
    const raw = source.slice(m.index + m[0].length, i)
    const selfClosing = /\/\s*$/.test(raw)
    yield { attrs: raw.replace(/\/\s*$/, ''), selfClosing }
    re.lastIndex = i
  }
}

// Parse <Route .../> and <Route ...> tags in source order. Routes nested in
// the Layout route ("/") are written relative; admin routes are absolute.
export function discoverRoutes(source) {
  const imports = {}
  for (const m of source.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)) imports[m[1]] = m[2]
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*React\.lazy\(\(\)\s*=>\s*import\('([^']+)'\)\)/g)) imports[m[1]] = m[2]

  const routes = []
  let parentPath = null
  for (const { attrs, selfClosing } of scanRouteTags(source)) {
    const path = attrs.match(/\bpath="([^"]+)"/)?.[1]
    const isIndex = /\bindex\b/.test(attrs)
    const elementMatch = /<Suspense/.test(attrs)
      ? attrs.match(/<(\w+)\s*\/>\s*<\/Suspense>/)
      : attrs.match(/element=\{<(\w+)/)
    const element = elementMatch?.[1] ?? null
    if (!selfClosing && path) {
      parentPath = path // layout route opening tag
      continue
    }
    let full
    if (isIndex) full = parentPath ?? '/'
    else if (path.startsWith('/')) full = path
    else full = `${(parentPath ?? '').replace(/\/$/, '')}/${path}`
    const redirect = attrs.match(/<Navigate\s+to="([^"]+)"/)?.[1] ?? null
    routes.push({
      path: full,
      element: redirect ? 'Navigate' : element,
      module: redirect ? null : (imports[element] ?? null),
      redirectTo: redirect,
      lazy: /Suspense/.test(attrs),
    })
  }
  return routes
}

// Sample URLs + states per route. Dynamic segments use real slugs from the
// live catalogue / blog (captured read-only) plus deliberately missing ones
// so not-found states are exercised too.
const SAMPLES = {
  '/': [{ url: '/', state: 'default' }],
  '/about': [{ url: '/about', state: 'default' }],
  '/contact': [{ url: '/contact', state: 'form idle' }],
  '/faq': [{ url: '/faq', state: 'default' }],
  '/instructions': [{ url: '/instructions', state: 'instructions/legal-style content' }],
  '/products': [{ url: '/products', state: 'catalogue (mock products + inventory)' }],
  '/products/driveshaft-cable-plus': [{ url: '/products/driveshaft-cable-plus', state: 'redirect to /products/driveshaft-cable' }],
  '/products/:slug': [
    { url: '/products/driveshaft-cable', state: 'out of stock product' },
    { url: '/products/value-brake-caging-bolt', state: 'in stock product' },
    { url: '/products/not-a-real-product', state: 'not found' },
  ],
  '/cart': [
    { url: '/cart', state: 'empty' },
    { url: '/cart', state: 'with items', seedCart: true },
  ],
  '/checkout': [{ url: '/checkout', state: 'with items (Stripe blocked, tax mocked)', seedCart: true }],
  '/checkout/success': [{ url: '/checkout/success', state: 'no order param' }],
  '/quote': [{ url: '/quote', state: 'form idle' }],
  '/order-tracking': [{ url: '/order-tracking', state: 'form idle' }],
  '/blog': [{ url: '/blog', state: 'list (mock posts)' }],
  '/blog/:slug': [
    { url: '/blog/building-a-maintenance-schedule-for-your-tow-truck-fleet', state: 'post (mock body)' },
    { url: '/blog/not-a-real-post', state: 'not found' },
  ],
  '/suggestions': [{ url: '/suggestions', state: 'form idle' }],
  '/testimonial': [{ url: '/testimonial', state: 'form idle' }],
  '/cart/recover/:token': [{ url: '/cart/recover/mock-token', state: 'recovery (mock RPC, empty result)' }],
  '/*': [{ url: '/this-page-does-not-exist', state: '404' }],
  '/admin/login': [{ url: '/admin/login', state: 'login form (no submit)' }],
}
const ADMIN_STATE = [
  { state: 'unauthenticated → redirect to /admin/login' },
  { state: 'mocked session + mocked/empty data (real auth/RLS untested)', mockAdminSession: true },
]

export function categorize(path) {
  if (path.startsWith('/admin/login')) return 'auth'
  if (path.startsWith('/admin')) return 'admin'
  if (path === '/*') return 'error'
  if (/^\/(cart|checkout|order-tracking|quote)/.test(path)) return 'commerce'
  if (path.includes(':')) return 'dynamic'
  if (path === '/instructions') return 'instructions'
  return 'public'
}

export function samplesFor(path) {
  if (SAMPLES[path]) return SAMPLES[path]
  if (path.startsWith('/admin')) return ADMIN_STATE.map((s) => ({ url: path, ...s }))
  return []
}

export function buildInventory(routes, previous = {}) {
  const prevByPath = Object.fromEntries((previous.routes ?? []).map((r) => [r.path, r]))
  return {
    generatedFrom: 'src/App.jsx',
    note: 'Regenerate with `node scripts/route-inventory.mjs`; smoke results are written by the browser smoke runner. No legal (privacy/terms) routes exist in the app.',
    routes: routes.map((r) => {
      const prev = prevByPath[r.path] ?? {}
      return {
        ...r,
        category: categorize(r.path),
        samples: samplesFor(r.path),
        work: prev.work ?? { status: 'pending', notes: '' },
        test: prev.test ?? { status: 'pending', results: [] },
      }
    }),
  }
}

export function checkCoverage(routes, inventory) {
  const problems = []
  const byPath = Object.fromEntries((inventory.routes ?? []).map((r) => [r.path, r]))
  for (const r of routes) {
    const entry = byPath[r.path]
    if (!entry) { problems.push(`missing from inventory: ${r.path}`); continue }
    if (!entry.samples?.length) problems.push(`no sample URL: ${r.path}`)
    if (!entry.work?.status || entry.work.status === 'pending') problems.push(`work status pending: ${r.path}`)
    if (!entry.test?.status || entry.test.status === 'pending') problems.push(`test status pending: ${r.path}`)
  }
  for (const p of Object.keys(byPath)) {
    if (!routes.some((r) => r.path === p)) problems.push(`stale inventory entry: ${p}`)
  }
  return problems
}

function main() {
  const routes = discoverRoutes(readFileSync(APP, 'utf8'))
  const previous = existsSync(INVENTORY_PATH) ? JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) : {}
  if (process.argv.includes('--check')) {
    const problems = checkCoverage(routes, previous)
    console.log(`${routes.length} routes declared in src/App.jsx`)
    if (problems.length) {
      console.log(problems.map((p) => `  ✗ ${p}`).join('\n'))
      process.exit(1)
    }
    console.log('  ✓ every declared route has samples, work status and test status')
    return
  }
  const inventory = buildInventory(routes, previous)
  mkdirSync(dirname(INVENTORY_PATH), { recursive: true })
  writeFileSync(INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`)
  console.log(`wrote ${inventory.routes.length} routes → ${INVENTORY_PATH}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
