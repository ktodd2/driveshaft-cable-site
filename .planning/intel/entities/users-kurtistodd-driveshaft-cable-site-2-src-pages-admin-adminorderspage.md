---
path: /Users/kurtistodd/driveshaft-cable-site-2/src/pages/admin/AdminOrdersPage.jsx
type: component
updated: 2026-02-04
status: active
---

# AdminOrdersPage.jsx

## Purpose

Admin dashboard page for managing customer orders. Provides authentication-protected interface to view, filter, and update order statuses with detailed order information display.

## Exports

- `AdminOrdersPage` (default): Main admin orders management component with authentication, order listing, filtering by status, and order detail modal view
- `formatPrice`: Re-exported utility function from cartStore for consistent price formatting

## Dependencies

- react-router-dom
- [[supabase]]: Database queries for orders table and authentication
- [[cartStore]]: formatPrice utility function

## Used By

TBD

## Notes

Requires authenticated session, redirects to /admin/login if not authenticated. Implements real-time clipboard copying for shipping addresses with visual feedback. Status updates persist to Supabase orders table.