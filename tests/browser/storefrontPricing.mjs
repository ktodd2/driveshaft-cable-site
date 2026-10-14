// Real catalog GETs + actual homepage/catalog cards, never detail-page proxies.
// Existing installed Playwright/Chrome only. Each route/scenario gets a fresh context.
// PRICING_MODES=normal,held,failed BASE_URL=... RELEASE_OUT=... node tests/browser/storefrontPricing.mjs
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:4175'
const out = resolve(process.env.RELEASE_OUT || '.release-artifacts/storefront-pricing')
const modes = (process.env.PRICING_MODES || 'normal,held,failed').split(',')
mkdirSync(out, { recursive: true })
const evidence = { base, startedAt: new Date().toISOString(), scenarios: [], samples: [], screenshots: [], pageErrors: [], blockedMutations: [] }
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const cases = [
  { slug: 'driveshaft-cable-cutters', min: 1, prices: [[1, 2500], [50, 2500]], base: 2500, labels: ['Per unit: $25.00/ea'] },
  { slug: 'driveshaft-cable-xl', min: 10, prices: [[10, 500], [50, 483], [100, 450], [200, 408]], base: 500, labels: ['10-49: $5.00/ea', '50-99: $4.83/ea', '100-199: $4.50/ea', '200+: $4.08/ea'] },
  { slug: 'driveshaft-cable', min: 10, prices: [[10, 300], [50, 290], [100, 270], [200, 245]], base: 300, labels: ['10-49: $3.00/ea', '50-99: $2.90/ea', '100-199: $2.70/ea', '200+: $2.45/ea'] },
  { slug: 'value-brake-caging-bolt', min: 1, prices: [[1, 2199], [5, 2099], [10, 1999], [20, 1899]], base: 2199, labels: ['1-4: $21.99/ea', '5-9: $20.99/ea', '10-19: $19.99/ea', '20+: $18.99/ea'] },
]
function assertCard(text, qty, cents, discount, label) {
  const unit = text.match(/(\$[\d,.]+)\s+per unit/)?.[1]
  const total = text.match(/Total:\s*(\$[\d,.]+)/)?.[1]
  assert.equal(unit, money(cents), label + ' unit')
  assert.equal(total, money(cents * qty), label + ' total')
  assert.equal(/Volume discount applied!/i.test(text), discount, label + ' volume label')
  assert.doesNotMatch(text, /Ends in|−\d+%/, label + ' unexpected sale')
  return { quantity: qty, unit, total, volumeDiscount: discount }
}
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  for (const [viewportName, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    for (const path of ['/', '/products']) for (const mode of modes) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' })
      const scenario = { viewport: viewportName, path, mode, cartPricingRequests: 0, catalog: [], firstCards: {}, images: [], assets: [], released: false }
      evidence.scenarios.push(scenario)
      let release
      const gate = new Promise(resolve => { release = resolve })
      await context.addInitScript(() => {
        localStorage.setItem('ktodd-newsletter-modal-dismissed', '1')
        window.__firstPriceCards = {}
        new MutationObserver(() => {
          for (const card of document.querySelectorAll('main article')) {
            const link = card.querySelector('a[href^="/products/"]')
            const text = card.innerText
            if (link && /per unit/.test(text) && /Total:/.test(text)) {
              const slug = link.getAttribute('href').split('/').pop()
              window.__firstPriceCards[slug] ??= text
            }
          }
        }).observe(document, { subtree: true, childList: true, characterData: true })
      })
      await context.route('**/*', async route => {
        const r = route.request(), u = new URL(r.url())
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) || u.pathname.includes('/functions/v1/')) {
          if (u.hostname.endsWith('.supabase.co')) evidence.blockedMutations.push({ method: r.method(), path: u.pathname })
          return route.abort()
        }
        if (/stripe|google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.net/.test(u.hostname)) return route.abort()
        if (u.pathname === '/rest/v1/products' && u.searchParams.get('select')?.includes('base_price_cents')) {
          scenario.cartPricingRequests++
          if (mode === 'failed') return route.abort('failed')
          if (mode === 'held') await gate
        }
        return route.continue()
      })
      const page = await context.newPage()
      page.on('pageerror', e => { if (!/Failed to load Stripe/.test(e.message)) evidence.pageErrors.push({ viewportName, path, mode, message: e.message }) })
      page.on('response', async response => {
        const u = new URL(response.url())
        if (u.pathname === '/rest/v1/products' && u.searchParams.get('is_storefront') === 'eq.true') {
          try {
            scenario.catalog = (await response.json()).map(p => ({ id: p.id, slug: p.slug, name: p.name, base_price_cents: p.base_price_cents, tiers: p.tiers, min_order_quantity: p.min_order_quantity, order_quantity_step: p.order_quantity_step }))
          } catch (e) { scenario.catalogError = e.message }
        }
      })
      try {
        const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' })
        assert.equal(response.status(), 200)
        await page.locator('main article input[type="number"]').first().waitFor()
        await page.waitForFunction(() => Object.keys(window.__firstPriceCards).length >= 4)
        scenario.firstCards = await page.evaluate(() => window.__firstPriceCards)
        scenario.assets = await page.locator('script[src*="/assets/"]').evaluateAll(els => els.map(e => e.src))
        for (const c of cases) {
          assertCard(scenario.firstCards[c.slug], c.min, c.base, false, `${path} ${mode} ${c.slug} first DOM render`)
          const row = scenario.catalog.find(p => p.slug === c.slug)
          assert.ok(row, `missing live catalog row: ${c.slug}`)
          assert.equal(row.base_price_cents, c.base)
          if (c.slug.endsWith('-cutters')) assert.deepEqual(row.tiers, [])
          const card = page.locator('main article').filter({ has: page.locator(`a[href="/products/${c.slug}"]`) })
          assert.equal(await card.count(), 1)
          const input = card.locator('input[type="number"]')
          assert.equal(await input.inputValue(), String(c.min))
          assert.equal(await input.getAttribute('step'), String(row.order_quantity_step))
          const banner = page.locator('.surface-gold [class~="bg-black/30"]').filter({ has: page.getByText(row.name, { exact: true }) })
          assert.equal(await banner.count(), 1)
          const bannerText = (await banner.innerText()).replace(/\s+/g, ' ')
          for (const label of c.labels) assert.ok(bannerText.includes(label), bannerText + ' missing ' + label)
          if (c.slug.endsWith('-cutters')) assert.doesNotMatch(bannerText, /10-49|50-99|100-199|200\+|discount|\$3\.00/i)
          const img = card.locator('img').first()
          await img.scrollIntoViewIfNeeded(); await img.evaluate(el => el.decode())
          for (const [qty, cents] of c.prices) {
            await input.fill(String(qty)); await input.blur()
            const text = await card.innerText()
            const sample = assertCard(text, qty, cents, cents < c.base, `${path} ${mode} ${c.slug}`)
            evidence.samples.push({ viewport: viewportName, path, mode, slug: c.slug, ...sample, text })
            if (mode === 'normal' && (c.slug.endsWith('-cutters') || c.slug.endsWith('-xl'))) {
              const filename = resolve(out, `${path === '/' ? 'home' : 'products'}-${viewportName}-${c.slug}-qty${qty}.png`)
              await card.screenshot({ path: filename })
              evidence.screenshots.push(filename)
            }
          }
          const image = await img.evaluate(el => ({ fit: getComputedStyle(el).objectFit, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, src: el.currentSrc }))
          assert.equal(image.fit, c.slug.endsWith('-cutters') ? 'contain' : 'cover')
          assert.ok(image.naturalWidth > 0)
          scenario.images.push({ slug: c.slug, ...image })
        }
        assert.ok(scenario.cartPricingRequests >= 1, 'race/failure scenario must exercise cart pricing query')
        // After all card assertions, verify reactive behavior after delayed DB pricing arrives.
        release(); scenario.released = true
        await page.waitForLoadState('networkidle')
        for (const c of cases) {
          const [qty, cents] = c.prices.at(-1)
          const card = page.locator('main article').filter({ has: page.locator(`a[href="/products/${c.slug}"]`) })
          assertCard(await card.innerText(), qty, cents, cents < c.base, `${path} ${mode} after settlement`)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'horizontal overflow')
        // Local cart only: prove first-render hydration keeps cutter quantity=1,
        // its $25 subtotal, $15 shipping and no discount even with cart GET failure.
        const cutter = page.locator('main article').filter({ has: page.locator('a[href="/products/driveshaft-cable-cutters"]') })
        await cutter.locator('input').fill('1'); await cutter.locator('input').blur()
        await cutter.getByRole('button', { name: 'Add 1 to Cart', exact: true }).click()
        await page.locator('header a[href="/cart"]:visible').first().click()
        await page.waitForURL('**/cart')
        await page.getByRole('heading', { level: 1, name: 'YOUR CART', exact: true }).waitFor()
        const cart = await page.locator('main').innerText()
        assert.match(cart, /\$25\.00\/unit/)
        assert.match(cart, /Subtotal\s*\$25\.00/)
        assert.match(cart, /Shipping\s*\$15\.00/)
        assert.match(cart, /Total\s*\$40\.00/)
        assert.doesNotMatch(cart, /Volume Discount Applied|Unlock Better Pricing/i)
        scenario.cart = cart
        scenario.pass = true
      } finally {
        release()
        await context.close()
        writeFileSync(resolve(out, 'verification.json'), JSON.stringify(evidence, null, 2))
      }
    }
  }
  assert.deepEqual(evidence.pageErrors, [])
  assert.deepEqual(evidence.blockedMutations, [])
  assert.equal(evidence.scenarios.length, 2 * 2 * modes.length)
  assert.equal(evidence.samples.length, evidence.scenarios.length * cases.reduce((n, c) => n + c.prices.length, 0))
  evidence.pass = true
} catch (e) {
  evidence.failure = e.stack
  throw e
} finally {
  await browser.close()
  evidence.finishedAt = new Date().toISOString()
  writeFileSync(resolve(out, 'verification.json'), JSON.stringify(evidence, null, 2))
}
console.log(JSON.stringify({ pass: evidence.pass, scenarios: evidence.scenarios.length, samples: evidence.samples.length, screenshots: evidence.screenshots.length, pageErrors: evidence.pageErrors, blockedMutations: evidence.blockedMutations, out }, null, 2))
