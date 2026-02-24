---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/CartPage.jsx
type: component
updated: 2026-02-24
status: active
---

# CartPage.jsx

## Purpose

Displays the shopping cart page where users can review items, adjust quantities, see pricing with bulk discounts, and proceed to checkout. Enforces minimum order quantity requirements and shows pricing breakdowns.

## Exports

- `CartPage` (default): Main cart page component that manages cart display and checkout flow
- `CartPage` (named): Same component exported as named export

## Dependencies

**Internal:**
- [[cartStore]] - Cart state management with selectors for totals, pricing, and validation

**External:**
- react - Component framework
- react-router-dom - Navigation and routing (Link, useNavigate)

## Used By

TBD

## Notes

Implements quantity controls with +/- buttons, displays bulk discount messaging when threshold is met, shows minimum order warnings, and disables checkout button until minimum order quantity is reached. Uses utility functions from cartStore for price formatting and calculations.