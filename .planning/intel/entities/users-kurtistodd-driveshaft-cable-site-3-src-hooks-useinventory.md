---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/hooks/useInventory.js
type: hook
updated: 2026-03-09
status: active
---

# useInventory.js

## Purpose

Custom React hook for fetching and managing product inventory from Supabase. Provides real-time stock quantity tracking and manual stock updates for the e-commerce product catalog.

## Exports

- `useInventory(productId)` - React hook that returns `{ stock, loading, refetch }` for a given product ID (defaults to '1')
- `updateStock(productId, newQuantity)` - Async function to update stock quantity in the database, returns `{ error }`

## Dependencies

- `react` (useState, useEffect)
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]] - Supabase client instance

## Used By

TBD

## Notes

- Default productId of '1' suggests single-product store design; may need refactoring for multi-product inventory
- No real-time subscription—uses manual `refetch` for updates; consider Supabase realtime for live inventory sync
- `updateStock` sets `updated_at` timestamp on each update for audit tracking