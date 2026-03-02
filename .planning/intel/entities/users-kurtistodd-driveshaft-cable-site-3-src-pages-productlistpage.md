---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/ProductListPage.jsx
type: component
updated: 2026-03-02
status: active
---

# ProductListPage.jsx

## Purpose

Displays the product catalog with a card-based layout showing the driveshaft cable product. Handles quantity selection with tiered pricing, add-to-cart functionality, and real-time inventory status.

## Exports

- `default` - ProductListPage component (main page export)
- `ProductListPage` - Named export of the page component

## Dependencies

- `react` - useState hook for quantity state management
- `react-router-dom` - Link component for navigation to product details
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]] - Cart state management, pricing utilities (useCartStore, formatPrice, PRICE_PER_UNIT, PRICING_TIERS, getPriceForQuantity, MIN_ORDER_QUANTITY)
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useinventory]] - Real-time inventory hook
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]] - SEO meta tags component

## Used By

TBD

## Notes

- Product data is currently hardcoded with a TODO comment indicating future Supabase integration
- Uses tiered pricing model where per-unit price decreases with quantity
- ProductCard is a local component handling individual product display with quantity controls
- Displays stock badge with "OUT OF STOCK" or quantity remaining
- Minimum order quantity enforced via MIN_ORDER_QUANTITY constant
- Industrial/professional aesthetic with gray-800 backgrounds and yellow-500 accent colors