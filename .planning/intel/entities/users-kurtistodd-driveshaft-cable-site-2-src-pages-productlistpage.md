---
path: /Users/kurtistodd/driveshaft-cable-site-2/src/pages/ProductListPage.jsx
type: component
updated: 2026-02-04
status: active
---

# ProductListPage.jsx

## Purpose

Displays the product catalog page with product cards for driveshaft cables. Handles product display, quantity selection, pricing calculations (including bulk pricing), and adding items to cart.

## Exports

- `ProductListPage` (default): Main page component that renders the product listing grid
- `ProductCard`: Individual product card component with image, specs, pricing, and add-to-cart functionality

## Dependencies

- react-router-dom (Link)
- [[cartstore|cartStore]] (useCartStore, formatPrice, pricing constants)

## Used By

TBD

## Notes

Currently uses hardcoded product data array that will be replaced with Supabase data later. Implements dynamic pricing based on quantity thresholds (bulk vs regular pricing). Contains inline SVG illustration for product visualization.