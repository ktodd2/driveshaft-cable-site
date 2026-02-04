import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

export const selectSubtotal = (state) =>
  state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

export const selectIsBulkOrder = (state) =>
  selectTotalItems(state) >= 10

// Helper function to format price from cents
export function formatPrice(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
