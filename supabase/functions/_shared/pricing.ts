// Server-side mirror of pricing constants from src/stores/cartStore.js.
//
// These MUST stay in sync with the frontend. If you change PRODUCT_PRICING,
// SHIPPING_FEE, or FREE_SHIPPING_THRESHOLD in cartStore.js, update this file
// in the same commit — otherwise client-displayed totals will disagree with
// server-computed totals, and Stripe Tax will calculate against the wrong
// subtotal.

export const MIN_ORDER_QUANTITY = 10
export const SHIPPING_FEE = 1500 // $15.00 in cents
export const FREE_SHIPPING_THRESHOLD = 40000 // $400.00 in cents

interface ProductPricing {
  name: string
  basePrice: number
  tiers: ReadonlyArray<{ min: number; price: number }>
}

// Per-product pricing — tier qualification is PER-PRODUCT (each line item's
// tier is based on its own quantity). Tiers MUST be ordered highest threshold
// first so the linear scan picks the best applicable tier.
export const PRODUCT_PRICING: Record<string, ProductPricing> = {
  '1': {
    name: 'Driveshaft Cable',
    basePrice: 345,
    tiers: [
      { min: 200, price: 290 },
      { min: 100, price: 315 },
      { min: 50,  price: 335 },
    ],
  },
  '2': {
    name: 'Driveshaft Cable +',
    basePrice: 395,
    tiers: [
      { min: 200, price: 340 },
      { min: 100, price: 365 },
      { min: 50,  price: 385 },
    ],
  },
}

// Back-compat aliases.
export const PRICE_PER_UNIT = PRODUCT_PRICING['1'].basePrice
export const PRICING_TIERS = PRODUCT_PRICING['1'].tiers

export function getPriceForQuantity(productId: string, qty: number): number {
  const pricing = PRODUCT_PRICING[productId] || PRODUCT_PRICING['1']
  for (const tier of pricing.tiers) {
    if (qty >= tier.min) return tier.price
  }
  return pricing.basePrice
}

export function computeShipping(subtotalCents: number): number {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}
