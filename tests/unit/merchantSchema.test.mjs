import { test } from 'node:test'
import assert from 'node:assert/strict'
import { productStructuredData, merchantOrganization, POLICY_URL, RETURN_POLICY_ID, SHIPPING_SERVICE_ID } from '../../src/lib/merchantSchema.js'

const cable = { id: '1', slug: 'driveshaft-cable', name: 'Driveshaft Cable', sku: 'KTDC-001', base_price_cents: 300, min_order_quantity: 10, order_quantity_step: 10, tiers: [{min: 200, price: 245}], images: ['/standard.jpg'], short_description: 'Cable for driveshaft tie-up' }
const bolt = { ...cable, id: '3', slug: 'value-brake-caging-bolt', name: 'Value Brake Caging Bolt (10-Pack)', base_price_cents: 2199, min_order_quantity: 1, order_quantity_step: 1 }
const offer = (product, options) => productStructuredData(product, options)[0].offers

test('one actual seller offer uses the minimum purchasable total, with pack quantity preserved', () => {
  const standard = offer(cable, {stock: 1000})
  assert.equal(standard['@type'], 'Offer')
  assert.equal(standard.price, '30.00')
  assert.equal(standard.eligibleQuantity.minValue, 10)
  assert.equal(standard.availability, 'https://schema.org/InStock')
  assert.equal(standard.offerCount, undefined)
  assert.equal(standard.lowPrice, undefined)
  assert.equal(offer({...cable, id: 'xl', base_price_cents: 500}).price, '50.00')
  const pack = productStructuredData(bolt, {stock: 85})[0]
  assert.equal(pack.offers.price, '21.99')
  assert.equal(pack.offers.eligibleQuantity.unitText, '10-packs')
  assert.equal(pack.additionalProperty.find(p => p.name === 'Bolts per pack').value, 10)
  assert.equal(offer({...cable, base_price_cents: 2500, min_order_quantity: 1, tiers: []}).price, '25.00')
})

test('sold-out, unknown and partial remaining stock never get a false in-stock or minimum claim', () => {
  assert.equal(offer(cable, {stock: 0}).availability, 'https://schema.org/OutOfStock')
  assert.equal(offer(cable, {stock: null}).availability, undefined)
  assert.equal(offer(cable, {stock: 10, stockLoading: true}).availability, undefined)
  const partial = offer(cable, {stock: 5})
  assert.equal(partial.eligibleQuantity.minValue, 5)
  assert.equal(partial.price, '15.00')
})

test('the active price comes from the same minimum-quantity calculation as the page', () => {
  const sale = offer(cable, {stock: 1000, minimumQuantity: 10, minimumUnitCents: 270, sale: {ends_at: '2026-11-15T00:00:00Z'}})
  assert.equal(sale.price, '27.00')
  assert.equal(sale.validThrough, '2026-11-15T00:00:00Z')
  assert.equal(sale.priceSpecification, undefined, 'no competing bulk or member prices')
  assert.equal(sale.hasMerchantReturnPolicy['@id'], RETURN_POLICY_ID)
  assert.equal(sale.shippingDetails.hasShippingService['@id'], SHIPPING_SERVICE_ID)
})

test('merchant policies encode exact threshold, approved returns and handling without inventing transit or restrictions', () => {
  const org = merchantOrganization({shippingFeeCents: 2000, freeShippingThresholdCents: 60000, includePolicies: true})
  const [paid, free] = org.hasShippingService.shippingConditions
  assert.equal(paid.orderValue.maxValue, 599.99)
  assert.equal(paid.shippingRate.value, 20)
  assert.equal(free.orderValue.minValue, 600)
  assert.equal(free.shippingRate.value, 0)
  assert.deepEqual(org.hasShippingService.handlingTime.duration, {'@type':'QuantitativeValue', value: 1, unitCode: 'DAY'})
  assert.equal(paid.transitTime, undefined)
  assert.equal(free.transitTime, undefined)
  assert.equal(org.hasMerchantReturnPolicy.merchantReturnDays, 90)
  assert.equal(org.hasMerchantReturnPolicy.returnFees, 'https://schema.org/ReturnFeesCustomerResponsibility')
  for (const field of ['itemCondition', 'restockingFee', 'refundType', 'returnShippingFeesAmount']) assert.equal(org.hasMerchantReturnPolicy[field], undefined)
  assert.equal(org.hasMerchantReturnPolicy.merchantReturnLink, POLICY_URL+'#returns')
})

test('public images are absolute and no manufacturer identifiers or reviews are invented', () => {
  const p = productStructuredData({...cable, images: ['/a.jpg', 'https://example.com/b.jpg', 'javascript:alert(1)', 'http://[bad']})[0]
  assert.deepEqual(p.image, ['https://driveshaftcable.com/a.jpg', 'https://example.com/b.jpg'])
  for (const field of ['mpn', 'gtin', 'aggregateRating', 'review']) assert.equal(p[field], undefined)
})
