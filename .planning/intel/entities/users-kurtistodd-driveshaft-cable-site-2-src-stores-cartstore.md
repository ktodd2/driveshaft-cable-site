---
path: /Users/kurtistodd/driveshaft-cable-site-2/src/stores/cartStore.js
type: hook
updated: 2026-02-04
status: active
---

# cartStore.js

## Purpose

Manages shopping cart state using Zustand with localStorage persistence. Handles cart items, quantity updates, bulk pricing discounts, and add-to-cart notifications.

## Exports

- `PRICE_PER_UNIT` - Standard price constant (400 cents/$4.00)
- `BULK_PRICE_PER_UNIT` - Discounted price for 100+ units (350 cents/$3.50)
- `BULK_THRESHOLD` - Quantity threshold for bulk pricing (100 units)
- `MIN_ORDER_QUANTITY` - Minimum order requirement (10 units)
- `useCartStore` - Zustand store hook with cart actions (addItem, updateQuantity, removeItem, clearCart, clearNotification)
- `selectTotalItems` - Selector to compute total item quantity across cart
- `selectSubtotal` - Selector to calculate subtotal with volume discount applied
- `selectPricePerUnit` - Selector to get current price per unit based on quantity
- `selectMeetsMinimum` - Selector to check if cart meets minimum order quantity
- `selectHasBulkDiscount` - Selector to check if cart qualifies for bulk discount
- `formatPrice` - Utility to format cents as dollar string

## Dependencies

- zustand
- zustand/middleware

## Used By

TBD

## Notes

Uses volume-based pricing logic: 100+ units automatically receive bulk discount. Notifications auto-dismiss after 3 seconds. Only cart items are persisted to localStorage (notifications are excluded).