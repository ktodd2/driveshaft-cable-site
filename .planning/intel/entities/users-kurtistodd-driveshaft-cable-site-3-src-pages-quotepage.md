---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/QuotePage.jsx
type: component
updated: 2026-03-02
status: active
---

# QuotePage.jsx

## Purpose

Page component for requesting volume pricing quotes. Handles form submission to Supabase, email notifications, and integrates with the cart store to pre-populate quantity from cart items.

## Exports

- `QuotePage` (default): React component rendering the quote request form with hero section, form fields, cart summary sidebar, and success/error states

## Dependencies

- `react-router-dom`: Link component for navigation
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]]: useCartStore for cart items, totalItems, subtotal, clearCart
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]]: supabase client, sendQuoteNotification function
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]]: SEOHead for page metadata

## Used By

TBD

## Notes

- Form state managed with useState, tracks idle/submitting/success/error status
- Quantity field pre-populated from cart totalItems when items exist
- Cart is cleared on successful quote submission
- Email notification is fire-and-forget (doesn't block on failure)
- Displays cart summary sidebar showing items being quoted when cart has items