---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/CheckoutPage.jsx
type: component
updated: 2026-02-24
status: active
---

# CheckoutPage.jsx

## Purpose

Implements the checkout flow for purchasing driveshaft cables, handling shipping information collection, Stripe payment integration, and order creation. Manages a two-step process: shipping details entry and payment processing with Stripe Elements.

## Exports

- `CheckoutPage` (default): Main checkout page component with shipping form and payment integration
- `PaymentForm`: Stripe payment form component that handles payment element rendering and submission

## Dependencies

External:
- react-router-dom (Link, useNavigate)
- @stripe/stripe-js (loadStripe)
- @stripe/react-stripe-js (Elements, PaymentElement, useStripe, useElements)

Internal:
- [[cartStore]] (useCartStore, selectTotalItems, selectSubtotal, selectPricePerUnit, formatPrice)
- [[supabase]] (supabase client)

## Used By

TBD

## Notes

Uses Stripe Payment Intents with client secret for secure payment processing. Creates order records in Supabase before payment, links them to payment intent. Supports state management for multi-step checkout (shipping info → payment). Return URL configuration required for Stripe redirect flow.