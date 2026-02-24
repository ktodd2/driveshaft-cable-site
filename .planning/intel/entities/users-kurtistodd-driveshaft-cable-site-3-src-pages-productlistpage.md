---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/ProductListPage.jsx
type: component
updated: 2026-02-24
status: active
---

# ProductListPage.jsx

## Purpose

Displays the main product listing page for driveshaft cables with product cards, pricing information, quantity selection, and add-to-cart functionality. Currently uses hardcoded product data with a placeholder for future Supabase integration.

## Exports

- `ProductListPage` (default): Main page component that renders the product grid
- `ProductCard`: Individual product card component with image, specs, pricing calculator, and cart controls

## Dependencies

- react-router-dom (Link)
- [[cartstore|cartStore]]: useCartStore hook, formatPrice, pricing constants (PRICE_PER_UNIT, BULK_PRICE_PER_UNIT, BULK_THRESHOLD, MIN_ORDER_QUANTITY)

## Used By

TBD

## Notes

Product data is currently hardcoded in the `products` array. Dynamic pricing based on quantity (bulk discounts at BULK_THRESHOLD). Uses SVG illustration for product visualization. Industrial design theme with yellow accent colors.