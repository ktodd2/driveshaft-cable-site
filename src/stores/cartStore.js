import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Pricing constants
export const PRICE_PER_UNIT = 300 // $3.00 in cents
export const MIN_ORDER_QUANTITY = 10 // Minimum order is 10 units

// Shipping constants
export const SHIPPING_FEE = 1000 // $10.00 in cents
export const FREE_SHIPPING_THRESHOLD = 10000 // $100.00 in cents - free shipping at or above this

// Loyalty discount for repeat customers (stacks with volume pricing)
export const REPEAT_CUSTOMER_DISCOUNT = 0.10 // 10% off subtotal

// Volume pricing tiers (must be ordered highest threshold first)
export const PRICING_TIERS = [
  { min: 200, price: 250, label: '200+' },
  { min: 100, price: 275, label: '100-199' },
  { min: 50, price: 290, label: '50-99' },
]

// Get price per unit for a given quantity
export function getPriceForQuantity(qty) {
  for (const tier of PRICING_TIERS) {
    if (qty >= tier.min) return tier.price
  }
  return PRICE_PER_UNIT
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

// Calculate subtotal with volume discount
export const selectSubtotal = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const pricePerUnit = getPriceForQuantity(totalQty)
  return totalQty * pricePerUnit
}

// Get the current price per unit based on quantity
export const selectPricePerUnit = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  return getPriceForQuantity(totalQty)
}

// Check if order meets minimum (reduced-minimum items bypass the threshold)
export const selectMeetsMinimum = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const hasReducedMinimum = state.items.some(item => item.reducedMinimum)
  return totalQty >= MIN_ORDER_QUANTITY || hasReducedMinimum
}

// Check if getting bulk discount
export const selectHasBulkDiscount = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  return totalQty >= PRICING_TIERS[PRICING_TIERS.length - 1].min
}

// Calculate shipping cost based on subtotal
export const selectShipping = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = totalQty * getPriceForQuantity(totalQty)
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}

// Calculate order total (subtotal + shipping)
export const selectOrderTotal = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = totalQty * getPriceForQuantity(totalQty)
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
