---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/stores/cartStore.js
type: hook
updated: 2026-02-24
status: active
---

# cartStore.js

## Purpose

Manages shopping cart state using Zustand with persistence, handling items, quantities, pricing logic with bulk discounts, and temporary notifications. Implements tiered pricing ($3.00 base, $2.50 for 50+ units) with a 10-unit minimum order requirement.

## Exports

- `PRICE_PER_UNIT` - Base price constant (300 cents = $3.00)
- `BULK_PRICE_PER_UNIT` - Discounted price for bulk orders (250 cents = $2.50)
- `BULK_THRESHOLD` - Quantity threshold for bulk pricing (50 units)
- `MIN_ORDER_QUANTITY` - Minimum order requirement (10 units)
- `useCartStore` - Zustand store hook with actions: addItem, updateQuantity, removeItem, clearCart, clearNotification
- `selectTotalItems` - Selector to compute total item quantity across cart
- `selectSubtotal` - Selector to compute subtotal with volume discount applied
- `selectPricePerUnit` - Selector to get current per-unit price based on quantity
- `selectMeetsMinimum` - Selector to check if order meets minimum quantity
- `selectHasBulkDiscount` - Selector to check if bulk discount is active
- `formatPrice` - Utility to format prices from cents to dollar strings

## Dependencies

- zustand
- zustand/middleware

## Used By

TBD

## Notes

Uses localStorage persistence (key: 'ktodd-cart') but excludes notification state. Notifications auto-clear after 3 seconds. Price calculation is based on total quantity across all items, not per-product.