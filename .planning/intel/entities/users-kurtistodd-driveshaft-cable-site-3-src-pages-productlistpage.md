---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/ProductListPage.jsx
type: component
updated: 2026-02-26
status: active
---

# ProductListPage.jsx

## Purpose

Displays a catalog of driveshaft cable products with quantity-based pricing tiers and add-to-cart functionality. Renders product cards with specs, volume discount information, and inventory-aware purchase controls.

## Exports

- `ProductListPage` (default): Main page component rendering the product catalog with pricing tiers and product cards

## Dependencies

- `react-router-dom`: Link component for navigation to product detail pages
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]]: useCartStore, formatPrice, PRICE_PER_UNIT, PRICING_TIERS, getPriceForQuantity, MIN_ORDER_QUANTITY
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useinventory]]: useInventory hook for stock availability

## Used By

TBD

## Notes

- Contains hardcoded product data with TODO comment indicating future Supabase integration
- ProductCard is an internal component handling quantity selection and cart operations
- Implements tiered pricing display showing volume discounts
- Uses MIN_ORDER_QUANTITY as the baseline for quantity controls