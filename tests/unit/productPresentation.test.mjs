import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { volumePricingRows, productMetadata } from '../../src/lib/productPresentation.js'

const xl = { name: 'Driveshaft Cable XL', sku: 'XL', base_price_cents: 500, min_order_quantity: 10, tiers: [{ min: 50, price: 483 }, { min: 100, price: 450 }, { min: 200, price: 408 }], specs: { Length: '60 inches', 'Cable diameter': '5/32 inch', 'Working Load Limit': '3000 lb' } }
const pricing = p => ({ basePrice: p.base_price_cents, minOrderQuantity: p.min_order_quantity, tiers: p.tiers })

test('XL labels use its own DB prices and threshold-derived ranges without mutation', () => {
  const before = JSON.stringify(xl)
  assert.deepEqual(volumePricingRows(pricing(xl)), [
    { min: 10, price: 500, label: '10-49' }, { min: 50, price: 483, label: '50-99' },
    { min: 100, price: 450, label: '100-199' }, { min: 200, price: 408, label: '200+' },
  ])
  assert.equal(JSON.stringify(xl), before)
})

test('cutters and unknown products never borrow standard cable discounts', () => {
  assert.deepEqual(volumePricingRows({ basePrice: 2500, minOrderQuantity: 1, tiers: [] }), [])
  assert.deepEqual(volumePricingRows(undefined), [])
})

test('standard cable and plus prices/thresholds retain their current schedules', () => {
  for (const prices of [[300, 290, 270, 245], [350, 340, 320, 295]]) {
    const rows = volumePricingRows({ basePrice: prices[0], minOrderQuantity: 10, tiers: [{ min: 200, price: prices[3] }, { min: 100, price: prices[2] }, { min: 50, price: prices[1] }] })
    assert.deepEqual(rows.map(r => r.label), ['10-49', '50-99', '100-199', '200+'])
    assert.deepEqual(rows.map(r => r.price), prices)
  }
})

test('single-unit products derive their own ranges, independent of tier order or stale labels', () => {
  const rows = volumePricingRows({ basePrice: 2199, minOrderQuantity: 1, tiers: [{ min: 20, price: 1899, label: 'wrong' }, { min: 5, price: 2099 }, { min: 10, price: 1999 }] })
  assert.deepEqual(rows.map(r => r.label), ['1-4', '5-9', '10-19', '20+'])
})

test('XL confirmed WLL and dimensions are retained in factual metadata', () => {
  const meta = productMetadata(xl)
  assert.equal(meta.title, 'Driveshaft Cable XL — 3000 lb WLL')
  for (const fact of ['3000 lb', '60 inches', '5/32 inch', '$5.00/unit', 'volume discounts']) assert.ok(meta.description.includes(fact))
})

test('standard cable verified rating is retained, but unrated accessories get no WLL or cable claim', () => {
  assert.match(productMetadata({ ...xl, name: 'Driveshaft Cable', specs: { 'Working Load Limit': '3000 lbs' } }).title, /3000 lbs WLL/)
  const meta = productMetadata({ name: 'Driveshaft Cable Cutters', base_price_cents: 2500, tiers: [], specs: { 'Sold as': 'One cutter' } })
  assert.equal(meta.title, 'Driveshaft Cable Cutters')
  assert.match(meta.description, /\$25\.00\/unit/)
  assert.doesNotMatch(JSON.stringify(meta), /3000|WLL|safety cable|volume discounts/i)
  assert.doesNotMatch(JSON.stringify(productMetadata({ name: 'New accessory', base_price_cents: 100 })), /WLL|3000|volume discounts/i)
})

test('static shell has no universal rating and lets Helmet replace fallback descriptions', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  assert.doesNotMatch(html, /3000|WLL/)
  for (const attribute of ['name="description"', 'property="og:description"', 'property="og:title"', 'name="twitter:description"']) {
    assert.ok(html.includes(`<meta data-rh="true" ${attribute}`))
  }
})

test('page wiring keeps presentation data live and cutter-only image containment intact', () => {
  const detail = readFileSync(new URL('../../src/pages/ProductDetailPage.jsx', import.meta.url), 'utf8')
  const cart = readFileSync(new URL('../../src/pages/CartPage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(detail + cart, /PRODUCT_PRICING|10-49 units|3000lb WLL/)
  assert.match(detail, /basePrice: product.base_price_cents/)
  assert.match(detail, /tiers: product.tiers/)
  assert.match(detail, /productMetadata\(product\)/)
  assert.match(detail, /product.id === 'driveshaft-cable-cutters' \? 'object-contain' : 'object-cover'/)
  assert.match(detail, /pricingRows.length > 0/)
  assert.match(cart, /getLivePricing\(\)/)
  assert.match(cart, /volumeProducts.length > 0/)
  assert.match(cart, /livePricing\[item.productId\]/)
})
