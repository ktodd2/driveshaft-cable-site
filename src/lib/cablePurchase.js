import {
  SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
  REPEAT_CUSTOMER_DISCOUNT,
  getPriceForQuantity,
  getTierPriceForQuantity,
  getActiveSaleForProduct,
} from '../stores/cartStore'

// Purchase-clarity helpers for the two cable product pages only (Standard and
// XL). Everything here is display logic: prices, sales, shipping and discount
// rules are read from the cart store / catalog rows, never re-defined.

export const CABLE_SLUGS = Object.freeze({ standard: 'driveshaft-cable', xl: 'driveshaft-cable-xl' })

export function isCableSlug(slug) {
  return slug === CABLE_SLUGS.standard || slug === CABLE_SLUGS.xl
}

// Price a selected quantity from the fetched catalog row itself. Passing the
// row keeps the XL page off the legacy product-1/2 fallback table.
export function cableSelectionPricing(product, quantity) {
  const tierUnitCents = getTierPriceForQuantity(product.id, quantity, product)
  const unitCents = getPriceForQuantity(product.id, quantity, product)
  const sale = getActiveSaleForProduct(product.id)
  return {
    quantity,
    tierUnitCents,
    unitCents,
    sale: sale ? { name: sale.name, percent: sale.discount_percent } : null,
    merchandiseCents: unitCents * quantity,
  }
}

// Same rule as cartStore.selectShipping / checkout: flat fee below the
// threshold, free at or above it, judged on the merchandise subtotal (after
// volume and sale pricing, before the returning-customer or code discount).
export function shippingForMerchandise(merchandiseCents) {
  const free = merchandiseCents >= FREE_SHIPPING_THRESHOLD
  return {
    free,
    shippingCents: free ? 0 : SHIPPING_FEE,
    remainingCents: free ? 0 : FREE_SHIPPING_THRESHOLD - merchandiseCents,
  }
}

export function returningDiscountPercent() {
  return Math.round(REPEAT_CUSTOMER_DISCOUNT * 100)
}

function specValue(specs, pattern) {
  for (const [key, value] of Object.entries(specs || {})) {
    if (pattern.test(key) && value) return String(value)
  }
  return null
}

function sentence(text) {
  const lower = text.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

// Catalog specs use slightly different keys per product ("Total Length" vs
// "Length", "Coupler Material" vs "Body color"), so match by meaning.
export function cableSpecs(product) {
  const specs = product?.specs || {}
  const length = specValue(specs, /^(total )?length$/i)
  const diameter = specValue(specs, /^cable diameter$/i)
  const body = specValue(specs, /^body colou?r$/i)
  const coupler = specValue(specs, /^coupler material$/i)
  return {
    length,
    diameter,
    appearance: body ? `${sentence(body)} body` : coupler ? `${sentence(coupler)} couplers` : null,
  }
}

// Returns null unless BOTH cable rows are present, so the comparison never
// renders half-empty or borrows data for a missing product.
export function buildCableComparison(products) {
  const list = Array.isArray(products) ? products : []
  const entries = [['standard', 'Standard'], ['xl', 'XL']].map(([key, label]) => {
    const product = list.find(p => p?.slug === CABLE_SLUGS[key])
    if (!product) return null
    return { key, label, product, slug: product.slug, href: `/products/${product.slug}`, ...cableSpecs(product) }
  })
  if (entries.some(e => !e)) return null
  return { entries }
}
