import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as presentation from '../../src/lib/productPresentation.js'

test('cutters retain the full photo by exact id or slug, even when hover zoom is requested', () => {
  assert.equal(typeof presentation.productImageClasses, 'function')
  for (const product of [{ id: 'driveshaft-cable-cutters' }, { slug: 'driveshaft-cable-cutters' }]) {
    assert.equal(presentation.productImageClasses(product), 'object-contain')
    assert.equal(presentation.productImageClasses(product, { hoverZoom: true }), 'object-contain')
  }
})

test('other products retain cover and their existing optional hover zoom', () => {
  assert.equal(typeof presentation.productImageClasses, 'function')
  for (const product of [{ id: 'driveshaft-cable' }, { slug: 'driveshaft-cable-xl' }, { id: 'value-brake-caging-bolt' }, { slug: 'driveshaft-cable-cutters-other' }, { name: 'Driveshaft Cable Cutters' }, {}, undefined]) {
    assert.equal(presentation.productImageClasses(product), 'object-cover')
    assert.equal(presentation.productImageClasses(product, { hoverZoom: true }), 'object-cover hover:scale-105')
  }
})

test('all storefront gallery/card images use the shared policy without independent cover or zoom', () => {
  for (const [path, count] of [
    ['components/landing/StorefrontProducts.jsx', 1],
    ['components/landing/ProductShowcase.jsx', 1],
    ['pages/ProductDetailPage.jsx', 2],
  ]) {
    const source = readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8')
    const images = source.match(/<img\b[\s\S]*?\/>/g) || []
    assert.equal(images.length, count, path)
    for (const image of images) {
      assert.match(image, /productImageClasses\(product/, path)
      assert.doesNotMatch(image, /object-cover|(?:group-)?hover:scale-/, path)
    }
    if (path.includes('ProductShowcase')) assert.match(source, /productImageClasses\(product, \{ hoverZoom: true \}\)/)
  }
})
