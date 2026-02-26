---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/CheckoutPage.jsx
type: component
updated: 2026-02-26
status: active
---

# CheckoutPage.jsx

## Purpose

Handles the complete checkout flow including customer information collection, Stripe payment processing, and order creation. Manages the multi-step checkout process from cart review through payment confirmation.

## Exports

- `CheckoutPage` (default): Main checkout page component with Stripe Elements integration

## Dependencies

- react-router-dom (navigation, Link component)
- @stripe/stripe-js (Stripe initialization)
- @stripe/react-stripe-js (Elements, PaymentElement, useStripe, useElements)
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]] (cart state, selectors, pricing utilities)
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]] (database client for order creation)
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useinventory]] (decrementStock function)

## Used By

TBD

## Notes

- Uses Stripe Elements for PCI-compliant payment collection
- Contains nested `PaymentForm` component that handles payment confirmation
- Integrates with Supabase for order persistence and status updates
- Uses cart store selectors for pricing calculations including shipping thresholds
- Handles both redirect and non-redirect payment flows