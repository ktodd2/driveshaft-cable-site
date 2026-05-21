import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

// Pricing constants — server-side copy lives at supabase/functions/_shared/pricing.ts
// and MUST be updated in the same commit if any of these change.
export const MIN_ORDER_QUANTITY = 10 // Minimum order is 10 units (total across cart)

// All order quantities round to multiples of this number. We pack and ship
// cables in 10-counts, so any odd quantity creates friction at fulfillment.
export const ORDER_QUANTITY_STEP = 10

// Normalize a typed/passed quantity to the order-step rule. The reducedMinimum
// exception lets a customer buy the final partial pack of stock (e.g. 5
// remaining when the shelf is otherwise empty) without being forced to a
// multiple of 10 they can't actually receive.
export function normalizeOrderQuantity(qty, opts = {}) {
  const n = Math.max(0, Math.floor(qty || 0))
  if (opts.reducedMinimum) return n
  if (n < ORDER_QUANTITY_STEP) return ORDER_QUANTITY_STEP
  return Math.round(n / ORDER_QUANTITY_STEP) * ORDER_QUANTITY_STEP
}

// Shipping constants
export const SHIPPING_FEE = 1500 // $15.00 in cents
export const FREE_SHIPPING_THRESHOLD = 40000 // $400.00 in cents - free shipping at or above this

// Loyalty discount for repeat customers (stacks with volume pricing)
export const REPEAT_CUSTOMER_DISCOUNT = 0.10 // 10% off subtotal

// Per-product pricing — each product carries its own base price and tier table.
// Volume tier qualification is PER-PRODUCT (each line item's tier is based on
// its own quantity, not the cart total). All tiers MUST be ordered highest
// threshold first so the linear scan picks the best applicable tier.
//
// PRODUCT_PRICING is the *initial fallback* — used at first paint and if the
// DB query fails. The cart store's `loadProducts()` action refreshes the
// in-memory map from the `products` table at app mount; admin edits via
// /admin/products call loadProducts() again so changes propagate without
// reloading the page.
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

// Decode the JSONB tiers stored in the DB into the in-memory tier shape the
// rest of the app expects. The DB stores `[{ min, price }, ...]`; the runtime
// shape adds a human-readable `label` for tier-table displays.
function makeTierLabel(min, allMins) {
  // Sort the tier minimums so we can compute "min-(next-1)" ranges. The
  // top tier is open-ended ("200+").
  const sorted = [...allMins].sort((a, b) => a - b)
  const idx = sorted.indexOf(min)
  if (idx === sorted.length - 1) return `${min}+`
  return `${min}-${sorted[idx + 1] - 1}`
}

function normalizeDbProduct(row) {
  const rawTiers = Array.isArray(row.tiers) ? row.tiers : []
  // Sort descending so getPriceForQuantity's first-match scan picks the
  // highest applicable tier.
  const sortedDesc = [...rawTiers].sort((a, b) => b.min - a.min)
  const allMins = rawTiers.map(t => t.min)
  const tiers = sortedDesc.map(t => ({
    min: t.min,
    price: t.price,
    label: makeTierLabel(t.min, allMins),
  }))
  return {
    name: row.name,
    basePrice: row.base_price_cents,
    tiers,
  }
}

// Back-compat aliases — existing pages still display tier tables using these
// constants. They mirror product '1' (the original Driveshaft Cable) so the
// existing "starting at $3.45" copy stays accurate.
export const PRICE_PER_UNIT = PRODUCT_PRICING['1'].basePrice
export const PRICING_TIERS = PRODUCT_PRICING['1'].tiers

// `livePricing` is the runtime source of truth for pricing — it starts as a
// clone of PRODUCT_PRICING (so first-paint and offline both work) and gets
// replaced by `loadProducts()` once the DB query resolves. We keep it as a
// module-scoped variable instead of zustand state because pricing reads happen
// in plain functions (selectors, cart math) that don't subscribe to the store.
let livePricing = { ...PRODUCT_PRICING }

// Get price per unit for a given (productId, qty). Falls back to product '1'
// pricing if the productId is unknown — defensive default so a stale cart from
// a previous deploy still renders sensibly.
export function getPriceForQuantity(productId, qty) {
  const pricing = livePricing[productId] || livePricing['1'] || PRODUCT_PRICING['1']
  for (const tier of pricing.tiers) {
    if (qty >= tier.min) return tier.price
  }
  return pricing.basePrice
}

// Read-only accessor for components that want the current pricing snapshot
// without re-rendering. For React subscriptions, use the zustand store's
// `productsLoadedAt` field as a re-render trigger.
export function getLivePricing() {
  return livePricing
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
      // Carried in from an abandoned-cart recovery link so checkout can
      // auto-apply the 5% code without the customer typing it. Cleared on
      // clearCart so a completed order doesn't leak the discount forward.
      recoveryDiscountCode: null,
      recoveryEmail: null,
      // Bumped every time loadProducts() successfully refreshes livePricing.
      // Components that want to re-render after a price edit can subscribe
      // to this field; pure cart-math reads from livePricing directly.
      productsLoadedAt: 0,

      loadProducts: async () => {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, base_price_cents, tiers, is_active')
            .eq('is_active', true)
          if (error) {
            console.warn('cartStore.loadProducts: falling back to hardcoded pricing', error)
            return
          }
          if (!data || data.length === 0) return
          const next = {}
          for (const row of data) {
            next[row.id] = normalizeDbProduct(row)
          }
          livePricing = next
          set({ productsLoadedAt: Date.now() })
        } catch (err) {
          console.warn('cartStore.loadProducts: unexpected error', err)
        }
      },

      addItem: (product, quantity = 1, options = {}) => {
        const items = get().items
        const existingIndex = items.findIndex(item => item.productId === product.id)
        const existingItem = existingIndex >= 0 ? items[existingIndex] : null

        // If the existing line is reducedMinimum (partial pack), preserve the
        // exception. Otherwise round the incoming quantity to a multiple of 10.
        const effectiveReducedMin =
          options.reducedMinimum || existingItem?.reducedMinimum
        const safeQty = normalizeOrderQuantity(quantity, {
          reducedMinimum: effectiveReducedMin,
        })

        if (existingIndex >= 0) {
          const newItems = [...items]
          const combined = (newItems[existingIndex].quantity || 0) + safeQty
          newItems[existingIndex].quantity = normalizeOrderQuantity(combined, {
            reducedMinimum: effectiveReducedMin,
          })
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
              quantity: safeQty,
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
          items: get().items.map(item => {
            if (item.productId !== productId) return item
            const safeQty = normalizeOrderQuantity(quantity, {
              reducedMinimum: item.reducedMinimum,
            })
            return { ...item, quantity: safeQty }
          })
        })
      },

      removeItem: (productId) => {
        set({ items: get().items.filter(item => item.productId !== productId) })
      },

      clearCart: () => set({ items: [], recoveryDiscountCode: null, recoveryEmail: null }),

      clearNotification: () => set({ notification: null }),
    }),
    {
      name: 'ktodd-cart',
      partialize: (state) => ({
        items: state.items,
        recoveryDiscountCode: state.recoveryDiscountCode,
        recoveryEmail: state.recoveryEmail,
      }), // Don't persist notification
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
    const basePrice = livePricing[item.productId]?.basePrice ?? PRICE_PER_UNIT
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
    const basePrice = livePricing[item.productId]?.basePrice ?? PRICE_PER_UNIT
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
