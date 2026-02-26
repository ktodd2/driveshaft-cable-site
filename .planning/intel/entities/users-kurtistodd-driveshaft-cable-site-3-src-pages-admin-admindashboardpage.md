---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminDashboardPage.jsx
type: component
updated: 2026-02-26
status: active
---

# AdminDashboardPage.jsx

## Purpose

Admin dashboard page component that provides an authenticated administrative interface for managing the e-commerce site. Displays statistics like pending quotes and inventory stock levels, with navigation to quote management and other admin functions.

## Exports

- `AdminDashboardPage` (default): Main admin dashboard React component with authentication check, stats display, and admin navigation

## Dependencies

- react (useState, useEffect)
- react-router-dom (Link, useNavigate)
- [[supabase]]: Authentication and database queries
- [[cartStore]]: formatPrice utility for currency formatting
- [[useInventory]]: Hook for real-time inventory stock tracking

## Used By

TBD

## Notes

- Requires authenticated session; redirects to `/admin/login` if no session exists
- Uses Supabase for both authentication state and fetching quote request statistics
- Inventory stock is loaded for product ID '1' via the useInventory hook
- Features responsive layout with collapsible sidebar on mobile