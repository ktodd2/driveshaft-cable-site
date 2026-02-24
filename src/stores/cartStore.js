import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Pricing constants
export const PRICE_PER_UNIT = 300 // $3.00 in cents
export const BULK_PRICE_PER_UNIT = 250 // $2.50 in cents for 50+ units
export const BULK_THRESHOLD = 50 // 50+ units gets bulk pricing
export const MIN_ORDER_QUANTITY = 10 // Minimum order is 10 units

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      notification: null,

      addItem: (product, quantity = 1) => {
        const items = get().items
        const existingIndex = items.findIndex(item => item.productId === product.id)

        if (existingIndex >= 0) {
          const newItems = [...items]
          newItems[existingIndex].quantity += quantity
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
              quantity
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
  const pricePerUnit = totalQty >= BULK_THRESHOLD ? BULK_PRICE_PER_UNIT : PRICE_PER_UNIT
  return totalQty * pricePerUnit
}

// Get the current price per unit based on quantity
export const selectPricePerUnit = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  return totalQty >= BULK_THRESHOLD ? BULK_PRICE_PER_UNIT : PRICE_PER_UNIT
}

// Check if order meets minimum
export const selectMeetsMinimum = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  return totalQty >= MIN_ORDER_QUANTITY
}

// Check if getting bulk discount
export const selectHasBulkDiscount = (state) => {
  const totalQty = state.items.reduce((sum, item) => sum + item.quantity, 0)
  return totalQty >= BULK_THRESHOLD
}

// Helper function to format price from cents
export function formatPrice(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
