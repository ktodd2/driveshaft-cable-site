---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/OrderSuccessPage.jsx
type: component
updated: 2026-03-01
status: active
---

# OrderSuccessPage.jsx

## Purpose

Handles the post-payment redirect from Stripe, displaying order confirmation status to customers. Updates order payment status in the database based on the Stripe redirect result and shows appropriate success/failure UI.

## Exports

- `OrderSuccessPage` (default) - React component that processes payment redirects and displays order confirmation

## Dependencies

- react-router-dom (external) - `Link`, `useSearchParams` for routing and URL parameter handling
- [[supabase]] - Database client for updating and fetching order data
- [[useInventory]] - `decrementStock` function (imported but usage truncated in visible code)

## Used By

TBD

## Notes

- Reads `order` and `redirect_status` query parameters from Stripe payment redirect
- Handles three payment states: succeeded, failed, and pending/processing
- Updates order status to 'confirmed' and payment_status to 'paid' on success
- The `decrementStock` import suggests inventory reduction happens here after successful payment