---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminDashboardPage.jsx
type: component
updated: 2026-02-28
status: active
---

# AdminDashboardPage.jsx

## Purpose

Admin dashboard page that displays business metrics including orders, revenue, inventory, and profit statistics. Provides product shipment cost tracking with CSV import from Pirate Ship for variable cost management.

## Exports

- `default` - AdminDashboardPage component (default export)
- `AdminDashboardPage` - Named export of the dashboard component

## Dependencies

- `react` - React hooks (useEffect, useState)
- `react-router-dom` - Link, useNavigate for routing
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]] - Database client
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]] - formatPrice utility
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useinventory]] - Inventory stock tracking
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useproductshipments]] - Product shipment cost tracking
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-costcalculations]] - calcProfitStats for profit analysis
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-csvparser]] - parsePirateShipFile for shipping cost import

## Used By

TBD

## Notes

- Requires authentication; redirects to /admin/login if no session
- Tracks multiple stat categories: quotes, orders, revenue (30d and all-time), units sold
- Supports fallback shipping cost stored in localStorage (key: 'ktodd-admin-shipping-fallback')
- Product shipments feature allows tracking variable costs with add/delete operations
- Integrates Pirate Ship CSV parsing for actual shipping cost data