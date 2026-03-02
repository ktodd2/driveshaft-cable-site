---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/CartPage.jsx
type: component
updated: 2026-03-02
status: active
---

# CartPage.jsx

## Purpose

Shopping cart page component that displays cart items, handles quantity adjustments, calculates pricing tiers and bulk discounts, and provides checkout navigation. Implements tiered pricing display, minimum order requirements, and shipping cost calculations.

## Exports

- `CartPage` (default) - Main cart page component with item management, pricing breakdown, and checkout flow

## Dependencies

- `react` - Core React library
- `react-router-dom` - Navigation and Link components
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]] - Cart state management, selectors, pricing constants, and utilities
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]] - SEO meta tag management

## Used By

TBD

## Notes

- Uses Zustand store with multiple selectors for derived cart state (totalItems, subtotal, shipping, etc.)
- Implements tiered pricing logic with `getNextTier()` to show users potential savings
- Enforces minimum order quantity (`MIN_ORDER_QUANTITY`) before allowing checkout
- Displays bulk discount indicators and free shipping threshold messaging
- Empty cart state renders a different UI with navigation back to products