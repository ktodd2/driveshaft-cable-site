---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/ProductDetailPage.jsx
type: component
updated: 2026-03-02
status: active
---

# ProductDetailPage.jsx

## Purpose

Product detail page component that displays comprehensive product information including image gallery, specifications, pricing tiers, quantity selection, and add-to-cart functionality. Handles the main product showcase with structured data for SEO.

## Exports

- `default` (ProductDetailPage) - Main page component for displaying individual product details with image carousel, specs table, tiered pricing, and cart integration

## Dependencies

- react-router-dom (external) - useParams, Link, useNavigate for routing
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]] - Cart state management, pricing utilities (formatPrice, getPriceForQuantity, PRICE_PER_UNIT, PRICING_TIERS, MIN_ORDER_QUANTITY)
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useinventory]] - useInventory hook for stock availability
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]] - SEOHead component for meta tags

## Used By

TBD

## Notes

- Contains hardcoded product data with comment indicating future Supabase integration
- Includes Schema.org Product structured data for SEO
- Implements tiered pricing display with bulk discount information
- Image gallery with 6 product images and thumbnail navigation
- Enforces MIN_ORDER_QUANTITY constraint on quantity input