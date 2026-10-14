// Real app + real read-only catalog checks, usable against preview or deployment.
// PLAYWRIGHT_MODULE=/existing/playwright CHROME_PATH=/path/to/Chrome
// BASE_URL=http://127.0.0.1:4173 RELEASE_OUT=/outside/repo node tests/browser/productRelease.mjs
// No backend mutations, payment calls, order submissions, or owner's browser session.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:4173'
const out = resolve(process.env.RELEASE_OUT || '.release-artifacts')
mkdirSync(out, { recursive: true })
const evidence = { base, startedAt: new Date().toISOString(), checks: [], screenshots: [], pageErrors: [], blockedMutations: [] }
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100)
const cases = [
  { slug: 'driveshaft-cable-cutters', name: 'Driveshaft Cable Cutters', min: 1, step: 1, prices: [[1, 2500], [50, 2500]], labels: [], stock: 80, wll: false },
  { slug: 'driveshaft-cable-xl', name: 'Driveshaft Cable XL', min: 10, step: 10, prices: [[10, 500], [40, 500], [50, 483], [90, 483], [100, 450], [190, 450], [200, 408]], labels: ['10-49: $5.00/ea', '50-99: $4.83/ea', '100-199: $4.50/ea', '200+: $4.08/ea'], stock: 2800, wll: true },
  { slug: 'driveshaft-cable', name: 'Driveshaft Cable', min: 10, step: 10, prices: [[10, 300], [40, 300], [50, 290], [90, 290], [100, 270], [190, 270], [200, 245]], labels: ['10-49: $3.00/ea', '50-99: $2.90/ea', '100-199: $2.70/ea', '200+: $2.45/ea'], wll: true },
  { slug: 'value-brake-caging-bolt', name: 'Value Brake Caging Bolt (10-Pack)', min: 1, step: 1, prices: [[1, 2199], [5, 2099], [10, 1999], [20, 1899]], labels: ['1-4: $21.99/ea', '5-9: $20.99/ea', '10-19: $19.99/ea', '20+: $18.99/ea'], wll: false },
]
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
async function safeContext(viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await ctx.addInitScript(() => localStorage.setItem('ktodd-newsletter-modal-dismissed', '1'))
  await ctx.route('**/*', async route => {
    const r = route.request(), u = new URL(r.url())
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) {
      // Analytics is also blocked, but any attempted Supabase mutation fails the run.
      if (u.host.endsWith('.supabase.co')) evidence.blockedMutations.push({ method: r.method(), path: u.pathname })
      return route.abort()
    }
    if (u.pathname.includes('/functions/v1/')) {
      evidence.blockedMutations.push({ method: r.method(), path: u.pathname }); return route.abort()
    }
    if (/stripe|google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.net/.test(u.host)) return route.abort()
    return route.continue()
  })
  return ctx
}
async function shot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  const file = resolve(out, name + '.png')
  await page.screenshot({ path: file, fullPage: true })
  evidence.screenshots.push(file)
}
async function containment(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'horizontal overflow')
}
async function goto(page, path) {
  const res = await page.goto(base + path, { waitUntil: 'networkidle' })
  assert.equal(res.status(), 200, path)
}
try {
  for (const [kind, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    for (const c of cases) {
      const ctx = await safeContext(viewport)
      const page = await ctx.newPage()
      page.on('pageerror', e => { if (!/Failed to load Stripe/.test(e.message)) evidence.pageErrors.push(e.message) })
      await goto(page, '/products/' + c.slug)
      await page.getByRole('heading', { level: 1, name: c.name, exact: true }).waitFor()
      const text = await page.locator('main').innerText()
      if (c.stock) assert.ok(text.includes(c.stock + ' units in stock'))
      const table = page.locator('[aria-label="Volume pricing"]')
      if (!c.labels.length) assert.equal(await table.count(), 0)
      else assert.deepEqual(await table.locator(':scope > span').allTextContents().then(a => a.map(t => t.trim())), c.labels)
      const meta = await page.evaluate(() => ({ title: document.title, description: document.querySelector('meta[name="description"]')?.content, keywords: document.querySelector('meta[name="keywords"]')?.content, ogTitle: document.querySelector('meta[property="og:title"]')?.content, twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content, structured: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)) }))
      assert.equal(meta.ogTitle, meta.title); assert.equal(meta.twitterTitle, meta.title)
      for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
        assert.equal(await page.locator(selector).count(), 1, `duplicate metadata: ${selector}`)
        assert.equal(await page.locator(selector).getAttribute('content'), meta.description)
      }
      if (c.wll) assert.match(meta.title, /3000 lbs? WLL/)
      else assert.doesNotMatch(JSON.stringify(meta), /3000|\bWLL\b|safety cable\./i)
      if (!c.labels.length) assert.doesNotMatch(meta.description, /volume discounts/i)
      if (c.slug.endsWith('-xl')) for (const spec of ['60 inches', '5/32 inch', '3000 lb']) { assert.ok(text.includes(spec)); assert.ok(meta.description.includes(spec)) }
      const img = page.locator(`img[alt="${c.name} - view 1"]`)
      await img.evaluate(el => el.decode())
      const metrics = await img.evaluate(el => {
        const b = el.getBoundingClientRect(), s = getComputedStyle(el)
        const scale = s.objectFit === 'contain' ? Math.min(b.width / el.naturalWidth, b.height / el.naturalHeight) : Math.max(b.width / el.naturalWidth, b.height / el.naturalHeight)
        return { objectFit: s.objectFit, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, width: b.width, height: b.height, clippedX: Math.max(0, el.naturalWidth - b.width / scale), clippedY: Math.max(0, el.naturalHeight - b.height / scale) }
      })
      assert.equal(metrics.objectFit, c.slug.endsWith('-cutters') ? 'contain' : 'cover')
      if (c.slug.endsWith('-cutters')) { assert.ok(metrics.clippedX < 0.001); assert.ok(metrics.clippedY < 0.001) }
      const input = page.locator('input[type="number"]')
      assert.equal(await input.inputValue(), String(c.min)); assert.equal(await input.getAttribute('min'), String(c.min)); assert.equal(await input.getAttribute('step'), String(c.step))
      const prices = []
      for (const [qty, cents] of c.prices) {
        await input.fill(String(qty)); await input.blur()
        const t = await page.locator('main').innerText()
        const unit = t.match(/SKU:[\s\S]*?\n(\$[\d,.]+)\nper unit/)?.[1]
        const total = t.match(/Total: (\$[\d,.]+)/)?.[1]
        assert.equal(unit, money(cents)); assert.equal(total, money(cents * qty))
        prices.push({ quantity: qty, unit, total })
      }
      await input.fill(String(c.min)); await input.blur()
      await containment(page); await shot(page, `${c.slug}-${kind}-product`)
      const result = { viewport: kind, slug: c.slug, meta, labels: c.labels, metrics, prices }
      if (c.slug.endsWith('-xl') || c.slug.endsWith('-cutters')) {
        await page.getByRole('button', { name: /^add to cart$/i }).click()
        await goto(page, '/cart')
        const cart = await page.locator('main').innerText()
        assert.ok(cart.includes(c.name)); assert.ok(cart.includes(money(c.prices[0][1]) + '/unit'))
        assert.match(cart, new RegExp('Subtotal\\s*' + money(c.min * c.prices[0][1]).replace('$', '\\$').replace('.', '\\.')))
        assert.match(cart, /Shipping\s*\$15\.00/)
        const rows = page.locator('[aria-label="Volume pricing"]')
        if (c.slug.endsWith('-cutters')) {
          assert.equal(await rows.count(), 0)
          assert.doesNotMatch(cart, /Unlock Better Pricing|Volume Discount Applied|Volume Pricing \(per product\)/i)
        } else {
          const ref = await rows.innerText()
          for (const price of ['$5.00/ea', '$4.83/ea', '$4.50/ea', '$4.08/ea']) assert.ok(ref.includes(price))
          assert.ok(cart.includes('Add 40 more Driveshaft Cable XL units to get $4.83/unit'))
          assert.doesNotMatch(ref, /\$3\.00|\$2\.90|Cable \+/)
        }
        result.cart = cart
        await containment(page); await shot(page, `${c.slug}-${kind}-cart`)
        if (c.slug.endsWith('-xl')) {
          // Clear only this disposable context's cart, then exercise a tiered line.
          await page.getByRole('button', { name: /^Clear Cart$/i }).click()
          await goto(page, '/products/' + c.slug)
          await page.locator('input[type="number"]').fill('50'); await page.locator('input[type="number"]').blur()
          await page.getByRole('button', { name: /^add to cart$/i }).click()
          await goto(page, '/cart')
          const tierCart = await page.locator('main').innerText()
          assert.ok(tierCart.includes('$4.83/unit')); assert.match(tierCart, /Subtotal\s*\$241\.50/)
          assert.match(tierCart, /Volume Discount Applied/); assert.match(tierCart, /\$8\.50/)
          assert.match(tierCart, /Total\s*\$256\.50/)
          assert.equal(await page.locator('.line-through').filter({ hasText: '$5.00' }).count(), 1)
          result.tierCart = tierCart
          await shot(page, `${c.slug}-${kind}-tier-cart`)
        }
      }
      evidence.checks.push(result)
      await ctx.close()
    }
    const ctx = await safeContext(viewport), page = await ctx.newPage()
    page.on('pageerror', e => { if (!/Failed to load Stripe/.test(e.message)) evidence.pageErrors.push(e.message) })
    for (const route of ['/', '/products', '/cart', '/products/driveshaft-cable-plus', '/products/not-a-real-product', '/this-page-does-not-exist']) {
      await goto(page, route); await containment(page)
      const text = await page.locator('main').innerText()
      if (route.includes('not-a-real-product')) assert.match(text, /Product Not Found/i)
      if (route.endsWith('-plus')) assert.equal(new URL(page.url()).pathname, '/products/driveshaft-cable')
      evidence.checks.push({ viewport: kind, route, http: 200, finalPath: new URL(page.url()).pathname, title: await page.title() })
    }
    await ctx.close()
  }
  assert.deepEqual(evidence.pageErrors, [])
  assert.deepEqual(evidence.blockedMutations, [])
  evidence.pass = true
} finally {
  await browser.close()
  evidence.finishedAt = new Date().toISOString()
  writeFileSync(resolve(out, 'verification.json'), JSON.stringify(evidence, null, 2))
}
console.log(JSON.stringify({ pass: evidence.pass, checks: evidence.checks.length, screenshots: evidence.screenshots.length, pageErrors: evidence.pageErrors, blockedMutations: evidence.blockedMutations, out }, null, 2))
