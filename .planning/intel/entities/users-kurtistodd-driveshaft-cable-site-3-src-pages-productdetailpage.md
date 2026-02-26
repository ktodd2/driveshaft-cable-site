---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/ProductDetailPage.jsx
type: component
updated: 2026-02-26
status: active
---

# ProductDetailPage.jsx

## Purpose

Product detail page component that displays full product information including images, specifications, pricing tiers, and add-to-cart functionality. Handles quantity selection with tiered pricing and integrates with cart and inventory systems.

## Exports

- **default** - ProductDetailPage component (also named export)
- **ProductDetailPage** - React component for rendering product details with image gallery, specs, bulk pricing, and cart integration

## Dependencies

- react-router-dom (useParams, Link, useNavigate)
- [[cartStore]] (useCartStore, formatPrice, getPriceForQuantity, PRICE_PER_UNIT, PRICING_TIERS, MIN_ORDER_QUANTITY)
- [[useInventory]] (useInventory hook for stock management)

## Used By

TBD

## Notes

- Contains hardcoded product data with TODO comment indicating future Supabase integration
- Implements tiered bulk pricing display using PRICING_TIERS from cartStore
- Product images array references local image assets in public directory
- Single product currently defined: 'driveshaft-cable' with detailed specs and features