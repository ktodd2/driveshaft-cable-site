import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Pricing constants — server-side copy lives at supabase/functions/_shared/pricing.ts
// and MUST be updated in the same commit if any of these change.
export const MIN_ORDER_QUANTITY = 10 // Minimum order is 10 units (total across cart)

// Shipping constants
export const SHIPPING_FEE = 1500 // $15.00 in cents
export const FREE_SHIPPING_THRESHOLD = 40000 // $400.00 in cents - free shipping at or above this

// Loyalty discount for repeat customers (stacks with volume pricing)
export const REPEAT_CUSTOMER_DISCOUNT = 0.10 // 10% off subtotal

// Per-product pricing — each product carries its own base price and tier table.
// Volume tier qualification is PER-PRODUCT (each line item's tier is based on
// its own quantity, not the cart total). All tiers MUST be ordered highest
// threshold first so the linear scan picks the best applicable tier.
export const PRODUCT_PRICING = {
  '1': {
    name: 'Driveshaft Cable',
    basePrice: 345, // $3.45
    tiers: [
      { min: 200, price: 290, label: '200+' },
      { min: 100, price: 315, label: '100-199' },
      { min: 50,  price: 335, label: '50-99' },
    ],
  },
  '2': {
    name: 'Driveshaft Cable +',
    basePrice: 395, // $3.95 — $0.50 more per piece than the original
    tiers: [
      { min: 200, price: 340, label: '200+' },
      { min: 100, price: 365, label: '100-199' },
      { min: 50,  price: 385, label: '50-99' },
    ],
  },
}

// Back-compat aliases — existing pages still display tier tables using these
// constants. They mirror product '1' (the original Driveshaft Cable) so the
// existing "starting at $3.45" copy stays accurate.
export const PRICE_PER_UNIT = PRODUCT_PRICING['1'].basePrice
export const PRICING_TIERS = PRODUCT_PRICING['1'].tiers

// Get price per unit for a given (productId, qty). Falls back to product '1'
// pricing if the productId is unknown — defensive default so a stale cart from
// a previous deploy still renders sensibly.
export function getPriceForQuantity(productId, qty) {
  const pricing = PRODUCT_PRICING[productId] || PRODUCT_PRICING['1']
  for (const tier of pricing.tiers) {
    if (qty >= tier.min) return tier.price
  }
  return pricing.basePrice
}

// Convenience: line total for a single cart item.
export function lineSubtotal(item) {
  return getPriceForQuantity(item.productId, item.quantity) * item.quantity
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      notification: null,

      addItem: (product, quantity = 1, options = {}) => {
        const items = get().items
        const existingIndex = items.findIndex(item => item.productId === product.id)

        if (existingIndex >= 0) {
          const newItems = [...items]
          newItems[existingIndex].quantity += quantity
          if (options.reducedMinimum) newItems[existingIndex].reducedMinimum = true
          set({ items: newItems })
        } else {
          set({
            items: [...items, {
              productId: product.id,
              name: product.name,
              slug: product.slug,
              price: product.price_cents,
              sku: product.sku,
              image: product.images?.[0] || null,
              quantity,
              ...(options.reducedMinimum && { reducedMinimum: true })
            }]
          })
        }

        // Show notification
        set({ notification: { name: product.name, quantity } })

        // Auto-hide notification after 3 seconds
        setTimeout(() => {
          set({ notification: null })
        }, 3000)
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set({
          items: get().items.map(item =>
            item.productId === productId ? { ...item, quantity } : item
          )
        })
      },

      removeItem: (productId) => {
        set({ items: get().items.filter(item => item.productId !== productId) })
      },

      clearCart: () => set({ items: [] }),

      clearNotification: () => set({ notification: null }),
    }),
    {
      name: 'ktodd-cart',
      partialize: (state) => ({ items: state.items }), // Don't persist notification
    }
  )
)

// Selector functions - use these to get computed values
export const selectTotalItems = (state) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0)

// Subtotal sums per-line totals using each product's own tier price.
export const selectSubtotal = (state) =>
  state.items.reduce((sum, item) => sum + lineSubtotal(item), 0)

// Weighted average price per unit across the cart. Kept for back-compat with
// summary displays that show one "per unit" figure — actual line items render
// their own per-item price now.
export const selectPricePerUnit = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  if (totalQty === 0) return 0
  return Math.round(selectSubtotal(state) / totalQty)
}

// Cart-total volume savings: how much the cart saved versus the products'
// base prices. Used for the "Volume Discount Applied!" line.
export const selectVolumeSavings = (state) =>
  state.items.reduce((sum, item) => {
    const basePrice = PRODUCT_PRICING[item.productId]?.basePrice ?? PRICE_PER_UNIT
    const tierPrice = getPriceForQuantity(item.productId, item.quantity)
    return sum + (basePrice - tierPrice) * item.quantity
  }, 0)

// Check if order meets minimum (reduced-minimum items bypass the threshold).
// Minimum is TOTAL cart quantity — so 5 + 5 across two products still qualifies.
export const selectMeetsMinimum = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const hasReducedMinimum = state.items.some(item => item.reducedMinimum)
  return totalQty >= MIN_ORDER_QUANTITY || hasReducedMinimum
}

// True if ANY line item has hit a volume tier (i.e. is paying below its base
// price). Used to show the "Volume Discount Applied!" banner.
export const selectHasBulkDiscount = (state) =>
  state.items.some(item => {
    const basePrice = PRODUCT_PRICING[item.productId]?.basePrice ?? PRICE_PER_UNIT
    return getPriceForQuantity(item.productId, item.quantity) < basePrice
  })

// Calculate shipping cost based on subtotal
export const selectShipping = (state) => {
  const subtotal = selectSubtotal(state)
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}

// Calculate order total (subtotal + shipping)
export const selectOrderTotal = (state) => {
  const subtotal = selectSubtotal(state)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  return subtotal + shipping
}

// Helper function to format price from cents
export function formatPrice(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
