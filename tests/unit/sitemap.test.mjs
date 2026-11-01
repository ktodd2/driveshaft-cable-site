import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSitemap, sitemapEntries, STATIC_PUBLIC_PATHS, lastModified } from '../../scripts/sitemap-helpers.mjs'

const now = Date.parse('2026-11-01T21:00:00Z')
test('new catalog products and published posts are discovered without hardcoded product paths', () => {
  const data = { products: [
    { slug: 'driveshaft-cable', updated_at: '2026-10-20T10:00:00Z', images: ['/cable.jpg'] },
    { slug: 'driveshaft-cable-xl', updated_at: '2026-10-29T11:00:00Z' },
    { slug: 'new-future-accessory', updated_at: '2026-10-30T12:00:00Z' },
  ], posts: [{ slug: 'field-guide', published_at: '2026-10-15T08:00:00Z', updated_at: '2026-10-31T09:00:00Z' }] }
  const paths = [...STATIC_PUBLIC_PATHS, ...data.products.map(p => `/products/${p.slug}`), '/blog/field-guide']
  const entries = sitemapEntries(data, paths)
  const xml = buildSitemap(entries, { now })
  assert.ok(xml.includes('<loc>https://driveshaftcable.com/products/new-future-accessory</loc>'))
  assert.ok(xml.includes('<loc>https://driveshaftcable.com/products/driveshaft-cable-xl</loc>'))
  assert.equal(entries.find(e => e.path === '/products').lastmod, '2026-10-30T12:00:00.000Z')
  assert.equal(entries.find(e => e.path === '/blog').lastmod, '2026-10-31T09:00:00.000Z')
  assert.equal(entries.find(e => e.path === '/faq').lastmod, null)
  assert.equal(entries.find(e => e.path === '/blog/field-guide').lastmod, '2026-10-31T09:00:00.000Z')
})
test('only canonical public pages are included and repeated entries are deduplicated', () => {
  const xml = buildSitemap([
    { path: '/' }, { path: '/products/cable', lastmod: '2026-10-01' },
    { path: '/products/cable', lastmod: '2026-10-25' },
    ...['/cart', '/checkout', '/checkout/success', '/order-tracking', '/admin', '/admin/orders', '/products/driveshaft-cable-plus', '/products/cable?tracking=1', '//external.example/path'].map(path => ({ path })),
  ], { now })
  assert.equal((xml.match(/<url>/g) || []).length, 2)
  assert.equal((xml.match(/<loc>https:\/\/driveshaftcable.com\/products\/cable<\/loc>/g) || []).length, 1)
  assert.match(xml, /2026-10-25T00:00:00.000Z/)
  assert.doesNotMatch(xml, /checkout|tracking|driveshaft-cable-plus|external.example|\/cart|\/admin/)
})
test('missing, invalid and future timestamps are omitted rather than replaced by deployment time', () => {
  for (const value of [undefined, '', 'invalid', '2027-01-01T00:00:00Z']) assert.equal(lastModified(value, now), null)
  assert.equal(lastModified('2026-10-31T12:00:00-05:00', now), '2026-10-31T17:00:00.000Z')
  const xml = buildSitemap([{ path: '/', lastmod: 'invalid' }, { path: '/products', lastmod: '2027-01-01' }], { now })
  assert.doesNotMatch(xml, /lastmod|2026-11-01/)
})
test('current product image URLs are XML-safe and unsafe protocols are excluded', () => {
  const xml = buildSitemap([{ path: '/products/cable', images: ['/image.jpg?a=1&b=2', 'https://cdn.example/cable.jpg', 'javascript:alert(1)', 'data:text/html,bad', null, '', 'https://user:password@cdn.example/private.jpg'] }], { now })
  assert.match(xml, /https:\/\/driveshaftcable.com\/image.jpg\?a=1&amp;b=2/)
  assert.match(xml, /https:\/\/cdn.example\/cable.jpg/)
  assert.doesNotMatch(xml, /javascript:|data:|password|private.jpg|<image:title>/)
})
