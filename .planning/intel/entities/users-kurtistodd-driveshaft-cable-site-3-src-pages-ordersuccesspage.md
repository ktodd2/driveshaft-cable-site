---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/OrderSuccessPage.jsx
type: component
updated: 2026-03-09
status: active
---

# OrderSuccessPage.jsx

## Purpose

Handles the post-payment redirect from Stripe, displaying order confirmation or failure status to customers. Updates order payment status in the database, decrements inventory on successful payments, and shows appropriate success/failure UI with order details and next steps.

## Exports

- `OrderSuccessPage` (default): React component that processes Stripe redirect parameters, updates order status, manages inventory, and renders confirmation/failure pages

## Dependencies

- [[supabase]]: Database client for updating orders and fetching order details
- [[seohead]]: SEO metadata component for page head
- react-router-dom: URL search params and navigation links
- react: Component state and effects

## Used By

TBD

## Notes

- Reads `order` and `redirect_status` from URL query parameters (Stripe redirect)
- Calls `decrementStock` function to reduce inventory on successful payment
- Uses hardcoded product ID '1' when decrementing stock (assumes single-product store)
- Displays different UI states: success (green checkmark), failed (red X with retry), pending
- Shows order confirmation number and sends confirmation email notification in success state