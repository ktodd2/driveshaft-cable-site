// Google references for the supported properties are recorded in
// docs/merchant-schema.md. Keep public policies and these values in sync.
export const SITE_ORIGIN = 'https://driveshaftcable.com'
export const MERCHANT_ID = `${SITE_ORIGIN}/#organization`
export const POLICY_URL = `${SITE_ORIGIN}/shipping-returns`
export const RETURN_POLICY_ID = `${POLICY_URL}#returns`
export const SHIPPING_SERVICE_ID = `${POLICY_URL}#shipping`
export const decimalPrice = cents => (cents / 100).toFixed(2)

export function merchantOrganization({ shippingFeeCents, freeShippingThresholdCents, includePolicies = false } = {}) {
  const organization = {
    '@context': 'https://schema.org', '@type': 'OnlineStore', '@id': MERCHANT_ID,
    name: 'Driveshaft Cable', url: SITE_ORIGIN,
    hasMerchantReturnPolicy: { '@id': RETURN_POLICY_ID }, hasShippingService: { '@id': SHIPPING_SERVICE_ID },
  }
  if (!includePolicies) return organization
  if (!Number.isInteger(shippingFeeCents) || !Number.isInteger(freeShippingThresholdCents)) throw new Error('Current shipping constants are required')
  const returnPolicy = {
    '@type': 'MerchantReturnPolicy', '@id': RETURN_POLICY_ID,
    applicableCountry: 'US', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 90, returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility', merchantReturnLink: `${POLICY_URL}#returns`,
  }
  const shipping = {
    '@type': 'ShippingService', '@id': SHIPPING_SERVICE_ID, name: 'U.S. standard shipping',
    description: 'Orders ship the next business day. Shipping is based on the merchandise subtotal after volume pricing and sales, before returning-customer or discount-code savings. Transit time depends on the carrier and destination.',
    fulfillmentType: 'https://schema.org/FulfillmentTypeDelivery',
    handlingTime: { '@type': 'ServicePeriod', businessDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => `https://schema.org/${day}`), duration: { '@type': 'QuantitativeValue', value: 1, unitCode: 'DAY' } },
    shippingConditions: [
      { '@type': 'ShippingConditions', shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
        orderValue: { '@type': 'MonetaryAmount', minValue: 0, maxValue: Number(decimalPrice(freeShippingThresholdCents - 1)), currency: 'USD' },
        shippingRate: { '@type': 'MonetaryAmount', value: Number(decimalPrice(shippingFeeCents)), currency: 'USD' } },
      { '@type': 'ShippingConditions', shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
        orderValue: { '@type': 'MonetaryAmount', minValue: Number(decimalPrice(freeShippingThresholdCents)), currency: 'USD' },
        shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' } },
    ],
  }
  return { ...organization, hasMerchantReturnPolicy: returnPolicy, hasShippingService: shipping }

}

// Each detail page has ONE seller offer, priced for its minimum order.
// Quantity discounts stay in the visible pricing table, not an AggregateOffer.
export function productStructuredData(product, { stock = null, stockLoading = false, minimumQuantity, minimumUnitCents, sale = null } = {}) {
  if (!product) return []
  const url = `${SITE_ORIGIN}/products/${product.slug}`
  const pack = product.slug === 'value-brake-caging-bolt' || product.id === '3'
  const knownStock = !stockLoading && Number.isFinite(stock)
  const standardMin = product.min_order_quantity ?? 1
  const min = minimumQuantity ?? (knownStock && stock > 0 && stock < standardMin ? stock : standardMin)
  const unitCents = minimumUnitCents ?? product.base_price_cents
  const unit = pack ? '10-packs' : 'units'
  const offer = {
    '@type': 'Offer', '@id': `${url}#offer`, url, priceCurrency: 'USD',
    price: decimalPrice(unitCents * min),
    name: `${min} ${pack ? (min === 1 ? '10-pack' : '10-packs') : (min === 1 ? 'unit' : 'units')} (minimum order)`,
    eligibleQuantity: { '@type': 'QuantitativeValue', minValue: min, unitText: unit },
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'OnlineStore', '@id': MERCHANT_ID, name: 'Driveshaft Cable', url: SITE_ORIGIN },
    hasMerchantReturnPolicy: { '@id': RETURN_POLICY_ID },
    shippingDetails: { '@type': 'OfferShippingDetails', hasShippingService: { '@id': SHIPPING_SERVICE_ID } },
    ...(knownStock ? { availability: `https://schema.org/${stock > 0 ? 'InStock' : 'OutOfStock'}` } : {}),
    ...(sale?.ends_at ? { validThrough: sale.ends_at } : {}),
  }
  const productJson = {
    '@context': 'https://schema.org', '@type': 'Product', '@id': `${url}#product`,
    name: product.name, description: product.short_description || (product.description || '').slice(0, 220),
    brand: { '@type': 'Brand', name: 'Driveshaft Cable' }, sku: product.sku,
    image: (product.images || []).flatMap(image => {
      try { const absolute = new URL(image, SITE_ORIGIN); return /^https?:$/.test(absolute.protocol) ? [absolute.href] : [] } catch { return [] }
    }),
    offers: offer,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Minimum order quantity', value: min, unitText: unit },
      { '@type': 'PropertyValue', name: 'Standard order increment', value: product.order_quantity_step ?? 1, unitText: unit },
      ...(pack ? [{ '@type': 'PropertyValue', name: 'Bolts per pack', value: 10 }] : []),
    ],
  }
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE_ORIGIN}/products` },
      { '@type': 'ListItem', position: 3, name: product.name, item: url },
    ],
  }
  return [productJson, breadcrumb]
}
