---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/OrderSuccessPage.jsx
type: component
updated: 2026-03-02
status: active
---

# OrderSuccessPage.jsx

## Purpose

Displays post-payment confirmation page that handles Stripe redirect results, updates order status in Supabase, decrements inventory stock, and shows appropriate success/failure UI to the customer.

## Exports

- `OrderSuccessPage` (default) - React component that renders order confirmation with payment status handling

## Dependencies

- [[supabase]] - Database client for order status updates
- [[useInventory]] - `decrementStock` function for inventory management
- [[SEOHead]] - Meta tags component for page SEO
- react-router-dom - URL params and navigation (Link, useSearchParams)
- react - Core React hooks (useEffect, useState)

## Used By

TBD

## Notes

- Reads `order` and `redirect_status` from URL search params (Stripe redirect)
- Automatically updates order to 'paid'/'confirmed' or 'failed' based on Stripe redirect status
- Decrements inventory by summing quantities from order items JSON array
- Hardcoded product ID '1' in decrementStock call - assumes single product catalog
- Shows different UI states: success (green checkmark), failed (red X with retry option), pending (loading)