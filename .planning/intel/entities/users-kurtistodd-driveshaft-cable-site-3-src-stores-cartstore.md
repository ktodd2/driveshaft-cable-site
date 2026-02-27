---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/stores/cartStore.js
type: store
updated: 2026-02-27
status: active
---

# cartStore.js

## Purpose

Zustand store managing shopping cart state with persistence, volume pricing tiers, shipping calculations, and repeat customer discounts. Handles cart operations (add, update, remove items) and provides selector functions for computed values like subtotals and order totals.

## Exports

- `PRICE_PER_UNIT` - Base price per unit in cents ($3.00)
- `MIN_ORDER_QUANTITY` - Minimum order requirement (10 units)
- `SHIPPING_FEE` - Flat shipping fee in cents ($10.00)
- `FREE_SHIPPING_THRESHOLD` - Subtotal threshold for free shipping ($100.00)
- `REPEAT_CUSTOMER_DISCOUNT` - 10% loyalty discount rate
- `PRICING_TIERS` - Volume discount tiers array (200+, 100-199, 50-99)
- `getPriceForQuantity(qty)` - Returns price per unit based on quantity tier
- `useCartStore` - Main Zustand store hook with cart state and actions
- `selectTotalItems(state)` - Selector for total item count
- `selectSubtotal(state)` - Selector for subtotal with volume pricing
- `selectPricePerUnit(state)` - Selector for current price tier
- `selectMeetsMinimum(state)` - Selector checking minimum order met
- `selectHasBulkDiscount(state)` - Selector checking if bulk discount applies
- `selectShipping(state)` - Selector for shipping cost (0 if free threshold met)
- `selectOrderTotal(state)` - Selector for final order total
- `formatPrice(cents)` - Utility to format cents as dollar string

## Dependencies

- `zustand` - State management library
- `zustand/middleware` - Persist middleware for localStorage

## Used By

TBD

## Notes

- Cart persisted to localStorage under key 'ktodd-cart'
- Notifications auto-clear after 3 seconds
- Volume pricing tiers must be ordered highest threshold first for `getPriceForQuantity` to work correctly
- Repeat customer discount stacks with volume pricing