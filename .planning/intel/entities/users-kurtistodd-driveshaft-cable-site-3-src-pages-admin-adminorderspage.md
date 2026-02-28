---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminOrdersPage.jsx
type: component
updated: 2026-02-28
status: active
---

# AdminOrdersPage.jsx

## Purpose

Admin page component for managing customer orders, including order listing, filtering by status/payment, tracking number management, inventory stock control, and bulk CSV import of shipping costs from carriers like Pirate Ship.

## Exports

- `AdminOrdersPage` (default): Main admin orders management page component

## Dependencies

- react (external)
- react-router-dom (external)
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]]: Database client
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]]: formatPrice utility
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useinventory]]: useInventory hook and updateStock function

## Used By

TBD

## Notes

- Manages multiple state concerns: orders, inventory, shipping costs, CSV import
- Supports filtering orders by status (all/pending/completed) and payment status
- Includes tracking number entry with carrier selection and email notification status
- CSV bulk import feature for Pirate Ship shipping cost data with row-by-row selection
- Shipping cost is stored in cents (actual_shipping_cost_cents) but displayed/edited as dollars