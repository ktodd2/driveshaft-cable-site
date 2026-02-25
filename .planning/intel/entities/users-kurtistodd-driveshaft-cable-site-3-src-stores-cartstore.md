---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/stores/cartStore.js
type: module
updated: 2026-02-24
status: active
---

# cartStore.js

## Purpose

Manages shopping cart state with persistent storage using Zustand. Implements volume-based pricing tiers with automatic discount calculation based on total quantity.

## Exports

- `PRICE_PER_UNIT` - Base price constant (300 cents/$3.00)
- `MIN_ORDER_QUANTITY` - Minimum order requirement (10 units)
- `PRICING_TIERS` - Array of volume discount tiers (50+, 100+, 200+ units)
- `getPriceForQuantity(qty)` - Returns price per unit based on quantity and tier thresholds
- `useCartStore` - Zustand store hook with actions: addItem, updateQuantity, removeItem, clearCart, clearNotification
- `selectTotalItems` - Selector for total item count across cart
- `selectSubtotal` - Selector for cart subtotal with volume pricing applied
- `selectPricePerUnit` - Selector for current price per unit based on cart quantity
- `selectMeetsMinimum` - Selector checking if cart meets minimum order quantity
- `selectHasBulkDiscount` - Selector checking if cart qualifies for volume discount
- `formatPrice` - Utility for formatting cents to dollar string

## Dependencies

- zustand
- zustand/middleware

## Used By

TBD

## Notes

Store is persisted to localStorage under key 'ktodd-cart'. Notification state is excluded from persistence. Pricing tiers must be ordered from highest to lowest threshold for correct calculation.