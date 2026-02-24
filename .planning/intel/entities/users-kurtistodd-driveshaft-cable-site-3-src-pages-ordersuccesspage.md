---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/OrderSuccessPage.jsx
type: component
updated: 2026-02-24
status: active
---

# OrderSuccessPage.jsx

## Purpose

Displays order confirmation after Stripe payment redirect, updates order payment status in Supabase based on redirect status, and shows appropriate success/failure messaging to customers.

## Exports

- `OrderSuccessPage` (default): React component that handles post-payment redirect flow, updates order status (paid/failed/pending), and displays confirmation or error UI with customer details.

## Dependencies

- react-router-dom (Link, useSearchParams)
- [[supabase]] (database operations)

## Used By

TBD

## Notes

Reads `order` and `redirect_status` query params from Stripe redirect. Updates order records with payment_status (paid/failed) and order status (confirmed). Handles three states: succeeded (paid), failed, and pending/processing.