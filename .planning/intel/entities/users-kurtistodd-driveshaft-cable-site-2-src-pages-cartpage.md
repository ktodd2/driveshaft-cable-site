---
path: /Users/kurtistodd/driveshaft-cable-site-2/src/pages/CartPage.jsx
type: component
updated: 2026-02-04
status: active
---

# CartPage.jsx

## Purpose

Displays the shopping cart with line items, quantity controls, and checkout/quote routing. Routes users to checkout for small orders or quote request for bulk orders (10+ items).

## Exports

- `default` (CartPage): Main cart page component
- `CartPage`: Named export of the cart page component

## Dependencies

- react (external)
- react-router-dom (external)
- [[users-kurtistodd-driveshaft-cable-site-2-src-stores-cartstore]]

## Used By

TBD

## Notes

Implements bulk order threshold at 10+ items, routing to quote page instead of standard checkout. Includes empty state handling with call-to-action to browse products.