---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/stores/cartStore.js
type: store
updated: 2026-02-26
status: active
---

# cartStore.js

## Purpose

Zustand store managing shopping cart state with persistence, volume-based pricing tiers, and shipping fee calculations. Handles cart operations (add, update, remove items) and provides selectors for computed values like subtotals and discounts.

## Exports

- `PRICE_PER_UNIT` - Base price per unit in cents ($3.00)
- `MIN_ORDER_QUANTITY` - Minimum order quantity (10 units)
- `SHIPPING_FEE` - Flat shipping fee in cents ($10.00)
- `FREE_SHIPPING_THRESHOLD` - Subtotal threshold for free shipping in cents ($100.00)
- `PRICING_TIERS` - Array of volume discount tiers (200+, 100-199, 50-99)
- `getPriceForQuantity(qty)` - Returns price per unit based on quantity tier
- `useCartStore` - Zustand hook for cart state and actions (addItem, updateQuantity, removeItem, clearCart, clearNotification)
- `selectTotalItems` - Selector for total item count
- `selectSubtotal` - Selector for subtotal with volume discount applied
- `selectPricePerUnit` - Selector for current price per unit based on cart quantity
- `selectMeetsMinimum` - Selector checking if minimum order quantity is met
- `selectHasBulkDiscount` - Selector checking if bulk discount is active
- `selectShipping` - Selector for shipping fee (0 if above threshold)
- `selectOrderTotal` - Selector for subtotal plus shipping
- `formatPrice(cents)` - Utility to format cents as dollar string

## Dependencies

- zustand (external)
- zustand/middleware (external)

## Used By

TBD

## Notes

- Cart persisted to localStorage under key 'ktodd-cart'
- Notification state not persisted (auto-clears after 3 seconds)
- Pricing tiers must be ordered highest threshold first for correct tier matching