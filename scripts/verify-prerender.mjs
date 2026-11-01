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
  for (const script of head.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(script[1])
  if (path.startsWith('/products/')) {
    const product = state.products.find(p => path === `/products/${p.slug}`)
    assert.ok(product, path)
    assert.ok(head.includes('"@type":"Product"'), `Product schema: ${path}`)
    assert.ok(html.includes(product.sku), `SKU in initial HTML: ${path}`)
    assert.ok(html.includes(`value="${product.min_order_quantity}"`), `Product minimum on first render: ${path}`)
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
