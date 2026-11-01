import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isUtilityPath } from '../../src/lib/indexingPolicy.js'

test('utility indexing covers bare routes, nested admin, checkout and recovery tokens', () => {
  for (const path of ['/cart', '/cart/', '/cart/recover/public-test-token', '/checkout', '/checkout/success', '/admin', '/admin/login', '/admin/orders', '/order-tracking', '/suggestions', '/testimonial']) assert.equal(isUtilityPath(path), true, path)
  for (const path of ['/', '/products', '/products/driveshaft-cable', '/blog', '/blog/field-guide', '/shipping-returns', '/quote', '/cartography', '/administrator']) assert.equal(isUtilityPath(path), false, path)
})

test('robots permits reading utility noindex instructions and retains the sitemap', () => {
  const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8')
  assert.doesNotMatch(robots, /^Disallow:/m)
  assert.match(robots, /Sitemap: https:\/\/driveshaftcable.com\/sitemap.xml/)
})
