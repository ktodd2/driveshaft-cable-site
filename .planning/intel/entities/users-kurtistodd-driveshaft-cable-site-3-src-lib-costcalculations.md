---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/lib/costCalculations.js
type: util
updated: 2026-02-28
status: active
---

# costCalculations.js

## Purpose

Shared utility functions for calculating product costs, order profits, and aggregate profit statistics across admin pages. All monetary values are handled in integer cents to avoid floating-point precision issues.

## Exports

- **calcWeightedAvgCost(shipments)** - Calculates weighted average cost per unit from shipment records containing quantity and total_cost_cents
- **calcOrderProfit(order, avgCostPerUnit, fallbackShippingCents)** - Computes profit breakdown for a single order including product cost, shipping, and Stripe fees
- **calcProfitStats(ordersList, avgCostPerUnit, fallbackShippingCents)** - Aggregates profit statistics across multiple orders returning totals and margin percentage

## Dependencies

None

## Used By

TBD

## Notes

- Stripe fee calculation uses fixed formula: `(total * 2.9%) + 30¢`
- Orders without `actual_shipping_cost_cents` use fallback value and are tracked via `ordersWithoutShipping` counter
- All functions are pure with no side effects