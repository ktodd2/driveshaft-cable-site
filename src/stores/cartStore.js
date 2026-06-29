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
// multiple of step they can't actually receive. `opts.step` lets callers
// override the step for products that aren't pack-sized (e.g. the brake
// caging bolt has step=1); falls back to the global ORDER_QUANTITY_STEP.
export function normalizeOrderQuantity(qty, opts = {}) {
  const n = Math.max(0, Math.floor(qty || 0))
  if (opts.reducedMinimum) return n
  const step = opts.step ?? ORDER_QUANTITY_STEP
  if (n < step) return step
  return Math.round(n / step) * step
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
    basePrice: 300, // $3.00
    minOrderQuantity: 10,
    orderQuantityStep: 10,
    tiers: [
      { min: 200, price: 245, label: '200+' },
      { min: 100, price: 270, label: '100-199' },
      { min: 50,  price: 290, label: '50-99' },
    ],
  },
  '2': {
    name: 'Driveshaft Cable +',
    basePrice: 350, // $3.50 — $0.50 more per piece than the original
    minOrderQuantity: 10,
    orderQuantityStep: 10,
    tiers: [
      { min: 200, price: 295, label: '200+' },
      { min: 100, price: 320, label: '100-199' },
      { min: 50,  price: 340, label: '50-99' },
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
    minOrderQuantity: row.min_order_quantity ?? MIN_ORDER_QUANTITY,
    orderQuantityStep: row.order_quantity_step ?? ORDER_QUANTITY_STEP,
    tiers,
  }
}

// Per-product min order quantity. Falls back to the global MIN_ORDER_QUANTITY
// for products that haven't been loaded yet or don't have a per-product
// override. Used by the cart-minimum check and by storefront +/- controls.
export function getMinForProduct(productId) {
  return livePricing[productId]?.minOrderQuantity ?? MIN_ORDER_QUANTITY
}

// Per-product order step (the +/- button increment). Falls back to the global
// ORDER_QUANTITY_STEP. The brake caging bolt has step=1; the cables have
// step=10 because they pack in 10-counts.
export function getStepForProduct(productId) {
  return livePricing[productId]?.orderQuantityStep ?? ORDER_QUANTITY_STEP
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

// Active sales loaded from the DB (loadSales). Same module-scope pattern as
// livePricing so plain pricing functions can read it without a hook. The
// active-window filter is applied at read time (not load time) so sales that
// start during a user's session kick in automatically.
let liveSales = []

// Find the best active sale that applies to a given product. Highest % wins;
// ties prefer the product-scoped sale over the sitewide one (so a product can
// be deeper-discounted than the rest of the store).
export function getActiveSaleForProduct(productId, sales = liveSales, now = Date.now()) {
  if (!sales || sales.length === 0) return null
  const candidates = []
  for (const s of sales) {
    if (!s.is_active) continue
    const start = new Date(s.starts_at).getTime()
    const end   = new Date(s.ends_at).getTime()
    if (now < start || now >= end) continue
    if (s.scope === 'sitewide' || s.product_id === productId) candidates.push(s)
  }
  if (!candidates.length) return null
  candidates.sort((a, b) =>
    b.discount_percent - a.discount_percent ||
    (b.scope === 'product' ? 1 : -1)
  )
  return candidates[0]
}

// Returns the tier-or-base price WITHOUT applying a sale. Used by the UI to
// render the strike-through "was" price next to the sale price.
export function getTierPriceForQuantity(productId, qty) {
  const pricing = livePricing[productId] || livePricing['1'] || PRODUCT_PRICING['1']
  for (const tier of pricing.tiers) {
    if (qty >= tier.min) return tier.price
  }
  return pricing.basePrice
}

function applySalePercent(basePrice, percent) {
  return Math.round((basePrice * (100 - percent)) / 100)
}

// Get price per unit for a given (productId, qty). Falls back to product '1'
// pricing if the productId is unknown — defensive default so a stale cart from
// a previous deploy still renders sensibly. Applies the best active sale, if
// any, on top of the tier/base price.
export function getPriceForQuantity(productId, qty) {
  const tierPrice = getTierPriceForQuantity(productId, qty)
  const sale = getActiveSaleForProduct(productId)
  if (!sale) return tierPrice
  return applySalePercent(tierPrice, sale.discount_percent)
}

// Read-only accessor for components that want the current pricing snapshot
// without re-rendering. For React subscriptions, use the zustand store's
// `productsLoadedAt` field as a re-render trigger.
export function getLivePricing() {
  return livePricing
}

// Read-only accessor for the loaded sales list. Components should subscribe
// to `salesLoadedAt` on the zustand store to re-render when this updates.
export function getLiveSales() {
  return liveSales
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
      // Same pattern for sales — bumped when loadSales() refreshes liveSales.
      salesLoadedAt: 0,

      loadProducts: async () => {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, base_price_cents, tiers, is_active, min_order_quantity, order_quantity_step')
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

      loadSales: async () => {
        try {
          const { data, error } = await supabase
            .from('sales')
            .select('id, name, discount_percent, scope, product_id, starts_at, ends_at, is_active')
          if (error) {
            console.warn('cartStore.loadSales: falling back to empty sales list', error)
            return
          }
          liveSales = Array.isArray(data) ? data : []
          set({ salesLoadedAt: Date.now() })
        } catch (err) {
          console.warn('cartStore.loadSales: unexpected error', err)
        }
      },

      addItem: (product, quantity = 1, options = {}) => {
        const items = get().items
        const existingIndex = items.findIndex(item => item.productId === product.id)
        const existingItem = existingIndex >= 0 ? items[existingIndex] : null

        // If the existing line is reducedMinimum (partial pack), preserve the
        // exception. Otherwise round the incoming quantity to a multiple of
        // the product-specific step.
        const effectiveReducedMin =
          options.reducedMinimum || existingItem?.reducedMinimum
        const step = getStepForProduct(product.id)
        const safeQty = normalizeOrderQuantity(quantity, {
          reducedMinimum: effectiveReducedMin,
          step,
        })

        if (existingIndex >= 0) {
          const newItems = [...items]
          const combined = (newItems[existingIndex].quantity || 0) + safeQty
          newItems[existingIndex].quantity = normalizeOrderQuantity(combined, {
            reducedMinimum: effectiveReducedMin,
            step,
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
              step: getStepForProduct(productId),
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

// The cart-level minimum is the MAX of every line item's product min. So a
// cart with only the brake caging bolt (min=1) needs >=1 total, a cart with
// any cable line (min=10) needs >=10 total, and a mixed cart with both
// inherits the higher 10-unit floor. Reduced-minimum (low-stock) items bypass
// the check entirely. Used both by the gate and by the "Add N more units"
// messaging on the cart page.
export const selectRequiredMinimum = (state) => {
  if (!state.items.length) return MIN_ORDER_QUANTITY
  return state.items.reduce(
    (max, item) => Math.max(max, getMinForProduct(item.productId)),
    0
  )
}

export const selectMeetsMinimum = (state) => {
  if (!state.items.length) return false
  if (state.items.some(item => item.reducedMinimum)) return true
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  return totalQty >= selectRequiredMinimum(state)
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
