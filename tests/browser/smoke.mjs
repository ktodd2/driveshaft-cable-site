// Browser smoke + behaviour checks for the design refresh.
//
// Runs the production build (`vite preview`) in an isolated, fresh headless
// Chrome profile. Every Supabase call is answered by an in-process mock
// (fixtures captured read-only from the public storefront); Stripe, analytics
// and ads are blocked. No request can reach a real backend: any non-GET to a
// non-mock origin fails the run.
//
// Playwright is NOT a project dependency. Point PLAYWRIGHT_MODULE at an
// existing install and optionally CHROME_PATH at a Chrome binary:
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
//   BASE_URL=http://127.0.0.1:4173 node tests/browser/smoke.mjs
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173'
const OUT = process.env.SMOKE_OUT || join(ROOT, '.refresh-artifacts/smoke')
const SHOTS = join(OUT, 'screenshots')
const FIXTURES = JSON.parse(readFileSync(process.env.FIXTURES || join(ROOT, 'tests/browser/fixtures/storefront-rest-get.json'), 'utf8'))
const INVENTORY_PATH = process.env.INVENTORY || join(ROOT, 'docs/design-refresh/route-inventory.json')
const MOCK_HOST = 'mockref.supabase.co'
mkdirSync(SHOTS, { recursive: true })

const fx = (prefix) => Object.entries(FIXTURES).find(([k]) => k.startsWith(prefix))?.[1]
const storefront = fx('products?select=*&is_active=eq.true&is_storefront') || []
const pricing = fx('products?select=id%2Cname%2Cbase_price_cents') || []
const blogList = fx('blog_posts?select=') || []
const stockById = {}
for (const [k, v] of Object.entries(FIXTURES)) {
  const id = k.match(/^product_inventory\?.*product_id=eq\.(\d+)/)?.[1]
  if (id) stockById[id] = v
}

const writes = [] // every mutating call the app attempted (all answered by the mock)
const leaks = []  // any request that tried to leave the sandbox

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
}

async function mockSupabase(route) {
  const req = route.request()
  const url = new URL(req.url())
  const method = req.method()
  const wantsObject = (req.headers().accept || '').includes('vnd.pgrst.object')
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const one = (rows) => {
    if (!wantsObject) return json(route, rows)
    if (rows.length === 1) return json(route, rows[0])
    return json(route, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
  }
  if (url.pathname.startsWith('/auth/v1/user')) return json(route, { id: '00000000-0000-0000-0000-000000000000', email: 'admin@mock.test', role: 'authenticated', aud: 'authenticated' })
  if (url.pathname.startsWith('/auth/v1/')) return json(route, {})
  if (method !== 'GET' && method !== 'HEAD') {
    writes.push({ method, path: url.pathname, body: req.postData()?.slice(0, 400) })
    if (url.pathname.includes('/functions/v1/calculate-tax')) return json(route, { taxCents: 0, tax_cents: 0, calculationId: 'mock' })
    if (url.pathname.includes('/rpc/')) return json(route, [])
    return json(route, url.pathname.includes('/functions/') ? { ok: true, mock: true } : [{ id: 1, mock: true }], url.pathname.includes('/functions/') ? 200 : 201)
  }
  const table = url.pathname.replace('/rest/v1/', '')
  const q = url.searchParams
  if (table === 'products') {
    const slug = q.get('slug')?.replace(/^eq\./, '')
    if (slug) return one(storefront.filter((p) => p.slug === slug))
    if ((q.get('select') || '').startsWith('id,name,base_price_cents')) return json(route, pricing)
    return json(route, storefront)
  }
  if (table === 'product_inventory') {
    const id = q.get('product_id')?.replace(/^eq\./, '')
    const row = id && stockById[id] ? [stockById[id]] : []
    return one(row)
  }
  if (table === 'sales') return json(route, fx('sales?') || [])
  if (table === 'blog_posts') {
    const slug = q.get('slug')?.replace(/^eq\./, '')
    if (slug) {
      const base = blogList.find((b) => b.slug === slug)
      if (!base) return one([])
      return one([{ ...base, status: 'published', author: 'Driveshaft Cable', featured_image: null,
        content: '## Mock article body\n\nThis paragraph is placeholder text injected by the smoke-test mock so the article layout can be checked. It is not site content.\n\nA second paragraph keeps the mid-article newsletter split realistic.\n\n- List item one\n- List item two\n\nClosing paragraph.' }])
    }
    return json(route, blogList)
  }
  return wantsObject ? one([]) : json(route, [])
}

async function sandbox(context) {
  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.host === MOCK_HOST) return mockSupabase(route)
    if (url.origin === new URL(BASE).origin) return route.continue()
    if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.host) && req.method() === 'GET') return route.continue()
    if (req.method() !== 'GET') leaks.push(`${req.method()} ${url.origin}${url.pathname}`)
    return route.abort() // stripe, analytics, ads, anything else
  })
}

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const SEED_CART = { state: { items: [{ productId: '3', name: 'Value Brake Caging Bolt (10-Pack)', slug: 'value-brake-caging-bolt', price: 2199, sku: 'KTDC-VBC-18', image: null, quantity: 2 }], recoveryDiscountCode: null, recoveryEmail: null }, version: 0 }
const MOCK_SESSION = { access_token: 'mock.mock.mock', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'mock', user: { id: '00000000-0000-0000-0000-000000000000', email: 'admin@mock.test', role: 'authenticated', aud: 'authenticated' } }
const BANNED = /dispatch|stays whole/i
const REPRESENTATIVE = new Set(['/', '/products', '/products/value-brake-caging-bolt', '/products/driveshaft-cable', '/cart', '/checkout', '/quote', '/blog', '/faq', '/instructions', '/about', '/order-tracking', '/this-page-does-not-exist', '/admin/login', '/contact'])

async function newContext(browser, kind, { seedCart = false, mockAdminSession = false } = {}) {
  const context = await browser.newContext({ ...VIEWPORTS[kind], reducedMotion: 'reduce' })
  await sandbox(context)
  await context.addInitScript(({ seedCart, cart, session, admin }) => {
    localStorage.setItem('ktodd-newsletter-modal-dismissed', '1')
    if (seedCart) localStorage.setItem('ktodd-cart', JSON.stringify(cart))
    if (admin) localStorage.setItem('sb-mockref-auth-token', JSON.stringify(session))
  }, { seedCart, cart: SEED_CART, session: MOCK_SESSION, admin: mockAdminSession })
  return context
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function audit(page) {
  return page.evaluate((banned) => {
    const header = document.querySelector('header')
    const fixedTop = header?.parentElement
    const headerBottom = fixedTop && getComputedStyle(fixedTop).position === 'fixed' ? fixedTop.getBoundingClientRect().bottom : 0
    const h1s = [...document.querySelectorAll('h1')]
    const firstH = h1s[0] || document.querySelector('main h2')
    const r = firstH?.getBoundingClientRect()
    return {
      title: document.title,
      h1Count: h1s.length,
      firstHeading: firstH?.textContent.trim().slice(0, 60) ?? null,
      headingClearsHeader: r ? (r.top + window.scrollY) >= headerBottom - 1 : null,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      bannedCopy: new RegExp(banned, 'i').test(document.body.innerText),
      smallTargets: [...document.querySelectorAll('main a, main button, header a, header button')]
        .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 24 && getComputedStyle(e).display !== 'inline' }).length,
      textLength: document.body.innerText.length,
    }
  }, BANNED.source)
}

function expectedConsole(text) {
  // Blocked third parties (Stripe/analytics/ads/fonts offline) are expected in the sandbox.
  return /ERR_FAILED|ERR_BLOCKED|net::|Failed to load Stripe\.js|Failed to load resource|googletag|adsbygoogle/i.test(text)
}

async function routeSmoke(browser, inventory) {
  const results = {}
  for (const entry of inventory.routes) {
    results[entry.path] = []
    for (const sample of entry.samples) {
      for (const kind of Object.keys(VIEWPORTS)) {
        const context = await newContext(browser, kind, sample)
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (e) => { if (!expectedConsole(e.message)) errors.push(`pageerror: ${e.message}`) })
        page.on('console', (m) => { if (m.type() === 'error' && !expectedConsole(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`) })
        let status = null
        try {
          const res = await page.goto(BASE + sample.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          status = res?.status() ?? null
          await settle(page)
        } catch (e) { errors.push(`nav: ${e.message}`) }
        const finalPath = new URL(page.url()).pathname
        const a = await audit(page).catch((e) => ({ auditError: e.message }))
        const shotName = `${kind}${sample.url.replace(/[^a-z0-9]+/gi, '_')}${sample.seedCart ? '_items' : ''}${sample.mockAdminSession ? '_mocksession' : ''}.png`
        if (REPRESENTATIVE.has(sample.url) || sample.mockAdminSession) {
          await page.screenshot({ path: join(SHOTS, shotName), fullPage: kind === 'desktop' || sample.url === '/' }).catch(() => {})
        }
        const pass = !errors.length && status === 200 && a.textLength > 50 && !a.overflowX && !a.bannedCopy && a.headingClearsHeader !== false
        results[entry.path].push({ url: sample.url, state: sample.state, viewport: kind, finalPath, httpStatus: status, pass, errors, ...a, screenshot: REPRESENTATIVE.has(sample.url) || sample.mockAdminSession ? `screenshots/${shotName}` : null })
        await context.close()
      }
    }
    const rs = results[entry.path]
    console.log(`${rs.every((r) => r.pass) ? '✓' : '✗'} ${entry.path} (${rs.length} checks)${rs.filter((r) => !r.pass).map((r) => `\n    ✗ ${r.viewport} ${r.url} [${r.state}] ${JSON.stringify({ s: r.httpStatus, ovf: r.overflowX, hdr: r.headingClearsHeader, ban: r.bannedCopy, len: r.textLength, err: r.errors })}`).join('')}`)
  }
  return results
}

// ---- Behaviour checks (mocked integrations) ------------------------------
const checks = []
async function check(name, fn) {
  try { await fn(); checks.push({ name, pass: true }); console.log(`  ✓ ${name}`) }
  catch (e) { checks.push({ name, pass: false, error: e.message }); console.log(`  ✗ ${name}: ${e.message}`) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

async function behaviour(browser) {
  console.log('\nBehaviour (mocked Supabase, Stripe blocked):')

  await check('hero spec values are static and exact at load and after 2s', async () => {
    const ctx = await newContext(browser, 'desktop'); const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    const read = () => page.$$eval('[aria-label="Key specifications"] dd', (d) => d.map((x) => x.textContent.trim()))
    await page.waitForSelector('[aria-label="Key specifications"] dd')
    const first = await read(); await page.waitForTimeout(2000); const later = await read()
    assert(JSON.stringify(first) === JSON.stringify(['5/32"', '39"', '3000 lbs', 'Class 7-8']), `unexpected specs ${JSON.stringify(first)}`)
    assert(JSON.stringify(first) === JSON.stringify(later), 'spec values changed over time')
    await ctx.close()
  })

  await check('storefront shows DB prices/stock unchanged; add-to-cart updates cart and totals', async () => {
    const ctx = await newContext(browser, 'desktop'); const page = await ctx.newPage()
    await page.goto(BASE + '/products', { waitUntil: 'domcontentloaded' }); await settle(page)
    const body = await page.innerText('main')
    assert(body.includes('$21.99'), 'bolt price $21.99 missing')
    assert(/OUT OF STOCK/i.test(body), 'out-of-stock state missing for cable')
    assert(/95 in stock/i.test(body), 'bolt stock (95) missing')
    const btn = page.getByRole('button', { name: /^Add \d+ to Cart$/ })
    assert(await btn.count() === 1, `expected exactly one enabled add button, got ${await btn.count()}`)
    const disabled = page.getByRole('button', { name: /Out of Stock/i })
    assert(await disabled.isDisabled(), 'out-of-stock button should be disabled')
    await btn.click()
    await page.getByRole('status').filter({ hasText: 'Added to Cart!' }).waitFor({ timeout: 3000 })
    const cartLabel = await page.locator('header a[href="/cart"]').first().getAttribute('aria-label')
    assert(/Cart, \d+ item/.test(cartLabel || ''), `cart label not updated: ${cartLabel}`)
    await page.goto(BASE + '/cart', { waitUntil: 'domcontentloaded' }); await settle(page)
    const cartText = await page.innerText('main')
    assert(cartText.includes('Value Brake Caging Bolt'), 'cart line missing')
    assert(cartText.includes('$21.99'), 'unit price missing in cart')
    await ctx.close()
  })

  await check('quote form submits to (mocked) quote_requests + notification function only', async () => {
    const before = writes.length
    const ctx = await newContext(browser, 'desktop'); const page = await ctx.newPage()
    await page.goto(BASE + '/quote', { waitUntil: 'domcontentloaded' }); await settle(page)
    const form = page.locator('form').first()
    for (const [sel, val] of [['input[name="name"]', 'Smoke Test'], ['input[name="email"]', 'smoke@example.test'], ['input[name="company"]', 'Mock Co'], ['input[name="phone"]', '5550100'], ['input[name="quantity"]', '50'], ['textarea[name="message"]', 'Automated mock test']]) {
      if (await form.locator(sel).count()) await form.locator(sel).first().fill(val)
    }
    if (await form.locator('select[name="quantity"]').count()) await form.locator('select[name="quantity"]').selectOption('50')
    await form.locator('button[type="submit"]').click()
    await page.waitForTimeout(1500)
    const mine = writes.slice(before)
    assert(mine.some((w) => w.path.includes('quote_requests')), `no quote_requests write captured: ${JSON.stringify(mine.map((w) => w.path))}`)
    assert(mine.some((w) => w.path.includes('send-quote-notification')), 'notification function not invoked')
    const posted = JSON.parse(mine.find((w) => w.path.includes('quote_requests')).body)
    assert(posted[0].email === 'smoke@example.test' && posted[0].quantity === 50, `unexpected payload ${JSON.stringify(posted)}`)
    await ctx.close()
  })

  await check('mobile action bar: hidden on load, shown after scroll, hidden on input focus, never covers footer', async () => {
    const ctx = await newContext(browser, 'mobile'); const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await settle(page)
    const bar = page.getByTestId('mobile-action-bar')
    assert(await bar.getAttribute('data-visible') === 'false', 'bar visible on first paint')
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5)); await page.waitForTimeout(400)
    assert(await bar.getAttribute('data-visible') === 'true', 'bar not shown after scroll')
    await page.locator('footer input[type="email"]').first().focus(); await page.waitForTimeout(300)
    assert(await bar.getAttribute('data-visible') === 'false', 'bar not hidden while typing')
    await page.evaluate(() => document.activeElement.blur())
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400)
    const overlap = await page.evaluate(() => {
      const barTop = document.querySelector('[data-testid="mobile-action-bar"]').getBoundingClientRect().top
      const last = [...document.querySelectorAll('footer p, footer a, footer span')].filter((e) => e.offsetParent).pop()
      return last.getBoundingClientRect().bottom - barTop
    })
    assert(overlap <= 0, `footer content hidden behind bar by ${overlap}px`)
    for (const p of ['/cart', '/checkout', '/quote', '/admin/login']) {
      await page.goto(BASE + p, { waitUntil: 'domcontentloaded' }); await settle(page)
      assert(await page.getByTestId('mobile-action-bar').count() === 0, `bar present on ${p}`)
    }
    await ctx.close()
  })

  await check('mobile menu: aria-expanded toggles, Escape closes and restores focus', async () => {
    const ctx = await newContext(browser, 'mobile'); const page = await ctx.newPage()
    await page.goto(BASE + '/about', { waitUntil: 'domcontentloaded' }); await settle(page)
    const btn = page.getByRole('button', { name: 'Open menu' })
    await btn.click()
    assert(await page.locator('#mobile-nav').isVisible(), 'menu did not open')
    assert(await page.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded') === 'true', 'aria-expanded not true')
    await page.keyboard.press('Escape')
    assert(await page.locator('#mobile-nav').count() === 0, 'Escape did not close menu')
    assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-controls')) === 'mobile-nav', 'focus not restored to menu button')
    await ctx.close()
  })

  await check('retired product URL redirects to main cable', async () => {
    const ctx = await newContext(browser, 'desktop'); const page = await ctx.newPage()
    await page.goto(BASE + '/products/driveshaft-cable-plus', { waitUntil: 'domcontentloaded' }); await settle(page)
    assert(new URL(page.url()).pathname === '/products/driveshaft-cable', `ended at ${page.url()}`)
    await ctx.close()
  })

  await check('admin routes redirect to login without a session', async () => {
    const ctx = await newContext(browser, 'desktop'); const page = await ctx.newPage()
    await page.goto(BASE + '/admin/orders', { waitUntil: 'domcontentloaded' }); await settle(page)
    assert(new URL(page.url()).pathname === '/admin/login', `ended at ${page.url()}`)
    await ctx.close()
  })

  await check('reduced motion: no running CSS animations on home after settle', async () => {
    const ctx = await newContext(browser, 'desktop'); const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await settle(page)
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getTiming().duration ?? 0) > 1).length)
    assert(running === 0, `${running} animations still running`)
    await ctx.close()
  })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'))
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
const scoped = only ? { ...inventory, routes: inventory.routes.filter((r) => only.test(r.path)) } : inventory
console.log(`Route smoke against ${BASE} (${scoped.routes.length} routes × samples × 2 viewports)`)
const results = await routeSmoke(browser, scoped)
if (!process.env.SKIP_BEHAVIOUR) await behaviour(browser)
await browser.close()

// Persist results into the inventory (per-route test status).
for (const entry of inventory.routes) {
  const rs = results[entry.path]
  if (!rs) continue
  entry.test = {
    status: rs.every((r) => r.pass) ? 'pass' : 'fail',
    method: 'headless Chrome smoke (desktop 1440×900 + mobile 390×844), mocked Supabase, Stripe/ads/analytics blocked',
    authenticated: entry.category === 'admin' ? 'mocked session only — real auth/RLS untested' : 'n/a',
    ranAt: new Date().toISOString(),
    results: rs.map(({ url, state, viewport, pass, finalPath, httpStatus, overflowX, headingClearsHeader, h1Count, errors, screenshot }) => ({ url, state, viewport, pass, finalPath, httpStatus, overflowX, headingClearsHeader, h1Count, errors, screenshot })),
  }
}
writeFileSync(INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`)
const summary = { base: BASE, routeChecks: Object.values(results).flat().length, routeFailures: Object.values(results).flat().filter((r) => !r.pass).length, behaviour: checks, writesCapturedByMock: writes.length, sandboxLeaks: leaks }
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\nroute checks: ${summary.routeChecks}, failures: ${summary.routeFailures}; behaviour: ${checks.filter((c) => c.pass).length}/${checks.length}; mock-captured writes: ${writes.length}; leaks: ${leaks.length}`)
if (leaks.length) console.log('LEAKS:', leaks)
process.exit(summary.routeFailures || checks.some((c) => !c.pass) || leaks.length ? 1 : 0)
