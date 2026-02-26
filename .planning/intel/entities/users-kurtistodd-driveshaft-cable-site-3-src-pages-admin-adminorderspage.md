---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminOrdersPage.jsx
type: component
updated: 2026-02-26
status: active
---

# AdminOrdersPage.jsx

## Purpose

Admin dashboard page for viewing and managing customer orders. Provides order listing with status/payment filtering, order detail modal, status updates, tracking number management with email notifications, and order statistics.

## Exports

- `AdminOrdersPage` (default) - Main admin orders management component with authentication check

## Dependencies

- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]] - Database client for orders CRUD
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]] - `formatPrice` utility for currency display
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useinventory]] - `useInventory`, `updateStock` for inventory management
- react-router-dom - Navigation and Link component
- react - useState, useEffect hooks

## Used By

TBD

## Notes

- Requires authenticated admin session; redirects to `/admin/login` if not authenticated
- Supports UPS and USPS tracking URL generation
- Sends tracking notification emails when tracking info is saved
- Status options: pending, processing, shipped, delivered, cancelled
- Payment filter options: all, paid, unpaid