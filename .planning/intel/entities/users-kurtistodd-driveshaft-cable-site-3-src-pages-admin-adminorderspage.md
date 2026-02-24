---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminOrdersPage.jsx
type: component
updated: 2026-02-24
status: active
---

# AdminOrdersPage.jsx

## Purpose

Admin dashboard page for viewing and managing customer orders. Provides authentication-protected interface for viewing order details, updating order status, filtering by status/payment, and accessing customer shipping information.

## Exports

- `default` (AdminOrdersPage): Main admin orders management component with order list, detail view, status updates, and filtering capabilities
- `AdminOrdersPage`: Named export of the same component

## Dependencies

- react-router-dom (useNavigate, Link)
- [[supabase]]: Database client for fetching orders and authentication
- [[cartStore]]: formatPrice utility function
- react (useState, useEffect)

## Used By

TBD

## Notes

- Requires authentication via Supabase session, redirects to /admin/login if not authenticated
- Supports filtering orders by status (pending/confirmed/shipped/delivered/cancelled) and payment status
- Includes clipboard functionality for copying shipping addresses
- Updates order status with optimistic UI updates