---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/hooks/useProductShipments.js
type: hook
updated: 2026-02-28
status: active
---

# useProductShipments.js

## Purpose

Custom React hook for managing product shipment inventory data. Provides CRUD operations for tracking shipments and calculates weighted average cost per unit across all shipments.

## Exports

- `useProductShipments` - Hook returning shipments state, loading status, average cost calculation, and methods for add/delete/refetch operations

## Dependencies

- react (useState, useEffect)
- [[supabase]] - Database client for shipment persistence
- [[costCalculations]] - calcWeightedAvgCost function for averaging costs

## Used By

TBD

## Notes

- Fetches from `product_shipments` table ordered by received_at descending
- Average cost recalculates on every render based on current shipments array
- Add/delete operations automatically refetch to sync state with database