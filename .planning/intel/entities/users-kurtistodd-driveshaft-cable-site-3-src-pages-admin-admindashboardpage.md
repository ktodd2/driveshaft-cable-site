---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminDashboardPage.jsx
type: component
updated: 2026-02-26
status: active
---

# AdminDashboardPage.jsx

## Purpose

Admin dashboard page that displays key business statistics and navigation for the K-Todd admin panel. Provides authenticated admin users with quick access to pending quotes, orders, and administrative functions.

## Exports

- `AdminDashboardPage` (default): Main dashboard component with auth checking, stats display, and admin navigation sidebar

## Dependencies

- react-router-dom (Link, useNavigate)
- [[users-kurtistodd-driveshaft-cable-site-3-lib-supabase]]: Supabase client for auth and data queries
- [[users-kurtistodd-driveshaft-cable-site-3-hooks-useinventory]]: Inventory management hook (imported but usage truncated)

## Used By

TBD

## Notes

- Requires authenticated session; redirects to `/admin/login` if not authenticated
- Fetches pending quote count from `quote_requests` table filtered by `status: 'new'`
- Uses K-Todd brand styling with yellow-500 accent color and dark theme
- Responsive layout with collapsible sidebar on mobile (hidden md:block)