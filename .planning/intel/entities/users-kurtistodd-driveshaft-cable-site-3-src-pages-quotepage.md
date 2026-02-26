---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/QuotePage.jsx
type: component
updated: 2026-02-26
status: active
---

# QuotePage.jsx

## Purpose

Page component for requesting volume pricing quotes. Handles form submission to Supabase, displays cart items if present, and shows volume pricing benefits.

## Exports

- `QuotePage` (default): React component rendering the quote request form with cart integration

## Dependencies

- `react-router-dom`: Link component for navigation
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]]: useCartStore for cart state (items, totalItems, clearCart, subtotal)
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]]: supabase client and sendQuoteNotification function

## Used By

TBD

## Notes

- Pre-populates quantity field from cart totalItems when cart has items
- Clears cart on successful quote submission
- Form state managed with useState (idle, submitting, success, error)
- Submits to `quote_requests` table in Supabase
- sendQuoteNotification is imported but not used in visible code (may be called elsewhere or truncated)