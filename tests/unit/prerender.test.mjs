import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readPublicSnapshot } from '../../src/ssg/bootstrap.js'
import { serializePublicData, routeFile, pageDocument } from '../../scripts/prerender-helpers.mjs'

test('public data cannot close script elements or inject executable HTML', () => {
  const data = { description: '</script><script>alert(1)</script>\u2028\u2029' }
  const encoded = serializePublicData(data)
  assert.doesNotMatch(encoded, /<|\u2028|\u2029/)
  assert.deepEqual(JSON.parse(encoded), data)
})
test('public paths are constrained to safe output directories', () => {
  assert.equal(routeFile('/'), 'index.html')
  assert.equal(routeFile('/products/driveshaft-cable-xl'), 'products/driveshaft-cable-xl')
  for (const path of ['/../private', '/products/../../admin', '/blog/%2e%2e', '/blog//post', '/blog/name?token=secret']) {
    assert.throws(() => routeFile(path), /Unsafe public path/)
  }
})
test('route SEO replaces the shell fallback without duplicate descriptions or titles', () => {
  const shell = '<html><head><title>Fallback</title><meta data-rh="true" name="description" content="Fallback"><meta charset="UTF-8"></head><body><div id="root"></div></body></html>'
  const html = pageDocument(shell, { head: '<title>Product</title><meta name="description" content="Cable">', html: '<main><h1>Cable</h1></main>' }, { path: '/products/cable' })
  assert.equal((html.match(/<title>/g) || []).length, 1)
  assert.equal((html.match(/name="description"/g) || []).length, 1)
  assert.match(html, /<meta charset="UTF-8">/)
  assert.match(html, /<div id="root"><main><h1>Cable<\/h1>/)
  assert.doesNotMatch(html, /Fallback/)
})

// Saved carts must be restored before a direct checkout renders, but after
// hydration on a generated public page.
test('public hydration is path-specific; checkout and SPA fallbacks use normal cart restoration', () => {
  const document = { getElementById: () => ({ textContent: JSON.stringify({ path: '/products/cable', products: [] }) }) }
  assert.ok(readPublicSnapshot(document, '/products/cable/'))
  assert.equal(readPublicSnapshot(document, '/checkout'), null)
  assert.equal(readPublicSnapshot(document, '/products/new-product'), null)
  assert.equal(readPublicSnapshot({ getElementById: () => null }, '/checkout'), null)
  assert.equal(readPublicSnapshot({ getElementById: () => ({ textContent: 'invalid' }) }, '/'), null)
})

test('public content containing replacement tokens is inserted literally', () => {
  const shell = '<head></head><div id="root"></div>'
  const html = pageDocument(shell, { head: '<title>$&</title>', html: '<h1>$$ $& $`</h1>' }, { path: '/' })
  assert.ok(html.includes('<title>$&</title>'))
  assert.ok(html.includes('<h1>$$ $& $`</h1>'))
})
