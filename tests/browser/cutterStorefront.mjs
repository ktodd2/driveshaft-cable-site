// Actual built/live pages only: isolated headless Chrome, read-only network.
// BASE_URL=... RELEASE_OUT=... PLAYWRIGHT_MODULE=... CHROME_PATH=... node tests/browser/cutterStorefront.mjs
// CAPTURE_BASELINE=1 records the old framing; BASELINE_JSON=... verifies other cards stayed unchanged.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:4174'
const out = resolve(process.env.RELEASE_OUT || '.release-artifacts/cutters')
const baseline = process.env.BASELINE_JSON ? JSON.parse(readFileSync(process.env.BASELINE_JSON, 'utf8')) : null
const captureOnly = process.env.CAPTURE_BASELINE === '1'
const slug = 'driveshaft-cable-cutters'
mkdirSync(out, { recursive: true })
const evidence = { base, captureOnly, startedAt: new Date().toISOString(), checks: [], screenshots: [], imageAssets: {}, pageErrors: [], blockedMutations: [] }
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
async function geometry(img) {
  return img.evaluate(el => {
    const s = getComputedStyle(el), b = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect()
    const scale = s.objectFit === 'contain' ? Math.min(b.width / el.naturalWidth, b.height / el.naturalHeight) : Math.max(b.width / el.naturalWidth, b.height / el.naturalHeight)
    const w = el.naturalWidth * scale, h = el.naturalHeight * scale
    const photo = { left: b.left + (b.width - w) / 2, right: b.left + (b.width + w) / 2, top: b.top + (b.height - h) / 2, bottom: b.top + (b.height + h) / 2 }
    const clipping = []
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const css = getComputedStyle(a), r = a.getBoundingClientRect()
      if (a === el || /hidden|clip|auto|scroll/.test(css.overflowX + css.overflowY)) {
        clipping.push({ tag: a.tagName, x: Math.max(0, r.left - photo.left, photo.right - r.right), y: Math.max(0, r.top - photo.top, photo.bottom - r.bottom) })
      }
    }
    return { src: el.currentSrc, alt: el.alt, className: el.className, objectFit: s.objectFit, objectPosition: s.objectPosition, transform: s.transform, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, width: b.width, height: b.height, frameWidth: p.width, frameHeight: p.height, photoWidth: w, photoHeight: h, maxClippedX: Math.max(...clipping.map(c => c.x)), maxClippedY: Math.max(...clipping.map(c => c.y)), clipping }
  })
}
function assertFull(m) {
  assert.equal(m.objectFit, 'contain')
  assert.ok(m.naturalWidth > 0 && m.naturalHeight > 0)
  assert.ok(m.maxClippedX < 0.1 && m.maxClippedY < 0.1, JSON.stringify(m))
  assert.ok(m.transform === 'none' || m.transform === 'matrix(1, 0, 0, 1, 0, 0)', m.transform)
}
async function recordAsset(ctx, src) {
  if (evidence.imageAssets[src]) return
  const res = await ctx.request.get(src)
  assert.equal(res.status(), 200)
  evidence.imageAssets[src] = createHash('sha256').update(await res.body()).digest('hex')
  if (baseline) assert.equal(evidence.imageAssets[src], baseline.imageAssets[src], 'approved photo bytes changed')
}
try {
  for (const [kind, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' })
    await ctx.addInitScript(() => localStorage.setItem('ktodd-newsletter-modal-dismissed', '1'))
    await ctx.route('**/*', route => {
      const req = route.request(), u = new URL(req.url())
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || u.pathname.includes('/functions/v1/')) {
        if (u.hostname.endsWith('.supabase.co')) evidence.blockedMutations.push({ method: req.method(), path: u.pathname })
        return route.abort()
      }
      if (/stripe|google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.net/.test(u.hostname)) return route.abort()
      return route.continue()
    })
    const page = await ctx.newPage()
    page.on('pageerror', e => { if (!/Failed to load Stripe/.test(e.message)) evidence.pageErrors.push(e.message) })
    for (const route of ['/products', '/', '/products/' + slug]) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' })
      assert.equal(response.status(), 200)
      const detail = route.endsWith(slug)
      const cutter = page.locator(detail ? 'main img[alt^="Driveshaft Cable Cutters"]' : `main a[href="/products/${slug}"] img`)
      await cutter.first().waitFor()
      const count = await cutter.count()
      assert.ok(count >= 1)
      const routeName = detail ? 'detail' : route === '/' ? 'home' : 'products'
      for (let i = 0; i < count; i++) {
        const img = cutter.nth(i)
        await img.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 170))
        await img.evaluate(el => Promise.race([el.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('Image decode timeout')), 20000))]))
        await page.mouse.move(1, 1)
        await page.waitForTimeout(400)
        const normal = await geometry(img)
        await recordAsset(ctx, normal.src)
        const name = `${routeName}-${kind}-${i + 1}`
        const frame = img.locator('..')
        for (const state of ['normal', 'hover']) {
          if (state === 'hover') { await img.hover(); await page.waitForTimeout(400) }
          const metrics = await geometry(img)
          if (!captureOnly) assertFull(metrics)
          const prefix = resolve(out, `${name}-${state}`)
          await page.screenshot({ path: prefix + '-viewport.png' })
          await frame.screenshot({ path: prefix + '-image.png' })
          if (!detail) await img.locator('xpath=ancestor::article').screenshot({ path: prefix + '-card.png' })
          evidence.screenshots.push(prefix + '-viewport.png', prefix + '-image.png', ...(!detail ? [prefix + '-card.png'] : []))
          evidence.checks.push({ viewport: kind, route, index: i, state, http: response.status(), metrics })
        }
        const hover = evidence.checks.at(-1).metrics
        assert.equal(hover.width, normal.width, 'unexpected cutter hover zoom')
        assert.equal(hover.height, normal.height, 'unexpected cutter hover zoom')
      }
      if (!detail) {
        const others = page.locator(`main article a[href^="/products/"]:not([href="/products/${slug}"]) img`)
        assert.ok(await others.count() > 0)
        for (const img of await others.all()) {
          await img.scrollIntoViewIfNeeded(); await img.evaluate(el => el.decode())
          await page.mouse.move(1, 1); await page.waitForTimeout(350)
          for (const state of ['normal', 'hover']) {
            if (state === 'hover') { await img.hover(); await page.waitForTimeout(350) }
            const metrics = await geometry(img)
            assert.equal(metrics.objectFit, 'cover')
            const check = { viewport: kind, route, other: true, state, metrics }
            if (baseline) {
              const before = baseline.checks.find(c => c.other && c.viewport === kind && c.route === route && c.state === state && c.metrics.alt === metrics.alt)
              assert.ok(before, metrics.alt)
              for (const key of ['className', 'objectFit', 'transform', 'width', 'height', 'frameWidth', 'frameHeight']) assert.equal(metrics[key], before.metrics[key], `other product changed: ${metrics.alt} ${key}`)
              // Relative public assets resolve against preview vs live origins.
              const comparableSrc = new URL(metrics.src)
              if (comparableSrc.origin === new URL(base).origin) {
                const baselineOrigin = new URL(baseline.base)
                comparableSrc.protocol = baselineOrigin.protocol
                comparableSrc.host = baselineOrigin.host
                comparableSrc.port = baselineOrigin.port
              }
              assert.equal(comparableSrc.href, before.metrics.src, `other product image changed: ${metrics.alt}`)
            }
            evidence.checks.push(check)
          }
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'horizontal overflow')
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
console.log(JSON.stringify({ pass: evidence.pass, captureOnly, checks: evidence.checks.length, cutterChecks: evidence.checks.filter(c => !c.other).length, otherChecks: evidence.checks.filter(c => c.other).length, screenshots: evidence.screenshots.length, pageErrors: evidence.pageErrors, blockedMutations: evidence.blockedMutations, out }, null, 2))
