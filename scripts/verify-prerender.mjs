import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { routeFile } from './prerender-helpers.mjs'
const manifest = JSON.parse(await readFile('dist/prerender-manifest.json', 'utf8'))
assert.ok(manifest.paths.includes('/products') && manifest.paths.includes('/faq'))
for (const path of manifest.paths) {
  const html = await readFile(`dist/${routeFile(path)}`, 'utf8')
  const head = html.slice(0, html.indexOf('</head>'))
  assert.equal((head.match(/<title[^>]*>/g) || []).length, 1, path)
  assert.equal((head.match(/name="description"/g) || []).length, 1, path)
  assert.ok(head.includes(`href="https://driveshaftcable.com${path}"`), `Canonical: ${path}`)
  assert.match(html, /<div id="root"><div/)
  assert.match(html, /<h1/)
  const state = JSON.parse(html.match(/<script id="__PUBLIC_DATA__" type="application\/json">([\s\S]*?)<\/script>/)[1])
  assert.equal(state.path, path)
  const schemas = [...head.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(script => JSON.parse(script[1]))
  if (path.startsWith('/products/')) {
    const product = state.products.find(p => path === `/products/${p.slug}`)
    assert.ok(product, path)
    assert.ok(head.includes('"@type":"Product"'), `Product schema: ${path}`)
    assert.ok(html.includes(product.sku), `SKU in initial HTML: ${path}`)
    const stock = state.inventory.find(row => row.product_id === product.id)?.stock_quantity
    const min = stock > 0 && stock < product.min_order_quantity ? stock : product.min_order_quantity
    const productSchema = schemas.find(schema => schema['@type'] === 'Product')
    const offer = productSchema.offers
    if (productSchema.image?.[0]) {
      const socialImage = productSchema.image[0].replace(/&/g, '&amp;')
      assert.ok(head.includes(`property="og:image" content="${socialImage}"`), `Product Open Graph image: ${path}`)
      assert.ok(head.includes(`name="twitter:image" content="${socialImage}"`), `Product Twitter image: ${path}`)
      assert.match(head, /property="og:image:alt" content="[^"]+"/)
      assert.match(head, /name="twitter:image:alt" content="[^"]+"/)
    }
    assert.doesNotMatch(html, /alt="[^"]*(?: - view \d+|thumbnail \d+)/, `Descriptive image text: ${path}`)
    assert.equal(offer['@type'], 'Offer', path)
    assert.equal(offer.eligibleQuantity.minValue, min, path)
    if (Number.isFinite(stock)) assert.equal(offer.availability, `https://schema.org/${stock > 0 ? 'InStock' : 'OutOfStock'}`, path)
    else assert.equal(offer.availability, undefined, path)
    const tier = [...(product.tiers || [])].sort((a, b) => b.min - a.min).find(tier => min >= tier.min)
    const unit = tier?.price ?? product.base_price_cents
    const discount = Math.max(0, ...(state.sales || []).filter(sale => sale.is_active && (sale.scope === 'sitewide' || sale.product_id === product.id) && Date.parse(sale.starts_at) <= Date.now() && Date.now() < Date.parse(sale.ends_at)).map(sale => sale.discount_percent))
    const cents = Math.round(unit * (100 - discount) / 100) * min
    assert.equal(offer.price, (cents / 100).toFixed(2), path)
    const priceLabel = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100)
    const minimumLine = html.match(/Minimum order: ([\s\S]*?)<\/p>/)?.[1].replace(/<!--.*?-->/g, '').replace(/<[^>]*>/g, '')
    assert.ok(minimumLine?.includes(priceLabel), `Visible minimum-order total matches schema: ${path}`)
    assert.equal(offer.hasMerchantReturnPolicy['@id'], 'https://driveshaftcable.com/shipping-returns#returns')
    assert.equal(offer.shippingDetails.hasShippingService['@id'], 'https://driveshaftcable.com/shipping-returns#shipping')
    assert.ok(html.includes(`value="${min}"`), `Product minimum on first render: ${path}`)
    assert.doesNotMatch(html, /Loading product…/)
  }
  if (path.startsWith('/blog/')) {
    assert.ok(head.includes('"@type":"BlogPosting"'), path)
    assert.ok(state.post && html.includes('<article'), path)
  }
}
for (const path of ['/cart', '/checkout', '/admin/login', '/order-tracking']) {
  const html = await readFile(`dist/${routeFile(path)}`, 'utf8')
  assert.ok(html.includes('<div id="root"></div>'), path)
  assert.ok(html.includes('content="noindex, nofollow"'), path)
  assert.ok(!html.includes('__PUBLIC_DATA__'), path)
}
console.log(`Verified initial HTML, SEO, schema and public-only data for ${manifest.paths.length} pages`)

const sitemap = await readFile('dist/sitemap.xml', 'utf8')
const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/driveshaftcable\.com([^<]*)<\/loc>/g)].map(match => match[1])
assert.equal(sitemapPaths.length, new Set(sitemapPaths).size, 'Duplicate sitemap URLs')
assert.deepEqual([...sitemapPaths].sort(), [...manifest.paths].sort(), 'Sitemap must match the generated public pages')
assert.doesNotMatch(sitemap, /driveshaft-cable-plus|\/checkout|\/cart|\/admin|\/order-tracking/)
console.log(`Verified sitemap coverage: ${sitemapPaths.length} unique canonical public URLs`)
