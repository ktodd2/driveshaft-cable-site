// Server-side mirror of pricing constants from src/stores/cartStore.js.
//
// These MUST stay in sync with the frontend. If you change PRICING_TIERS,
// PRICE_PER_UNIT, SHIPPING_FEE, or FREE_SHIPPING_THRESHOLD in cartStore.js,
// update this file in the same commit — otherwise client-displayed totals
// will disagree with server-computed totals, and Stripe Tax will calculate
// against the wrong subtotal.

export const PRICE_PER_UNIT = 345 // $3.45 in cents
export const MIN_ORDER_QUANTITY = 10
export const SHIPPING_FEE = 1500 // $15.00 in cents
export const FREE_SHIPPING_THRESHOLD = 40000 // $400.00 in cents

// Volume pricing tiers (must be ordered highest threshold first)
export const PRICING_TIERS = [
  { min: 200, price: 290 },
  { min: 100, price: 315 },
  { min: 50, price: 335 },
] as const

export function getPriceForQuantity(qty: number): number {
  for (const tier of PRICING_TIERS) {
    if (qty >= tier.min) return tier.price
  }
  return PRICE_PER_UNIT
}

export function computeShipping(subtotalCents: number): number {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}
