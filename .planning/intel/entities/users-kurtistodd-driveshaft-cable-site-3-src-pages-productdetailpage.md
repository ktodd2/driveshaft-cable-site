---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/ProductDetailPage.jsx
type: component
updated: 2026-02-24
status: active
---

# ProductDetailPage.jsx

## Purpose

Displays detailed product information for individual products, including specifications, features, applications, pricing, and quantity selector with add-to-cart functionality. Currently uses hardcoded product data with plans to migrate to Supabase.

## Exports

- `ProductDetailPage` (default): Main product detail page component that renders product info, specs, features, and cart controls
- `ProductDetailPage` (named): Same component exported as named export

## Dependencies

**External:**
- react
- react-router-dom (useParams, Link, useNavigate)

**Internal:**
- [[cartstore|cartStore]] (useCartStore, formatPrice)

## Used By

TBD

## Notes

- Product data is hardcoded in the file (products object) - TODO: migrate to Supabase
- Implements bulk pricing display when quantity >= bulk_threshold
- Shows notification popup after adding items to cart
- Handles 404 state for invalid product slugs
- Product images stored in /product-photos/ directory