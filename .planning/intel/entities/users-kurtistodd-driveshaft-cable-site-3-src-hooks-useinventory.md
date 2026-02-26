---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/hooks/useInventory.js
type: hook
updated: 2026-02-26
status: active
---

# useInventory.js

## Purpose

Custom React hook and utility functions for managing product inventory state via Supabase. Provides real-time stock fetching, manual stock updates, and atomic decrement operations for the product_inventory table.

## Exports

- `useInventory(productId)` - React hook that returns `{ stock, loading, refetch }` for a given product ID (defaults to '1')
- `updateStock(productId, newQuantity)` - Async function to set a product's stock to a specific quantity
- `decrementStock(productId, quantity)` - Async function to reduce stock by a given amount (floors at 0)

## Dependencies

- react (useState, useEffect)
- [[supabase]] - Supabase client for database operations

## Used By

TBD

## Notes

- `decrementStock` uses a fetch-then-update pattern rather than a true atomic decrement RPC, which could cause race conditions under concurrent updates
- Stock quantity is floored at 0 to prevent negative inventory
- Updates include `updated_at` timestamp for tracking changes