---
path: /Users/kurtistodd/driveshaft-cable-site-2/src/pages/CheckoutPage.jsx
type: component
updated: 2026-02-04
status: active
---

# CheckoutPage.jsx

## Purpose

Implements the e-commerce checkout flow with two-step process: shipping information collection and Stripe payment processing. Creates payment intents via Supabase Edge Functions and handles order completion with cart clearing.

## Exports

- `CheckoutPage` (default): Main checkout page component managing shipping form, payment processing, and order state
- `PaymentForm`: Nested component rendering Stripe PaymentElement and handling payment confirmation

## Dependencies

External:
- react-router-dom (Link, useNavigate)
- @stripe/stripe-js (loadStripe)
- @stripe/react-stripe-js (Elements, PaymentElement, useStripe, useElements)

Internal:
- [[cartStore]] (useCartStore, formatPrice)
- [[supabase]] (supabase client)

## Used By

TBD

## Notes

Uses Stripe's client-side payment confirmation with return_url redirect pattern. Integrates with Supabase Edge Function at `/create-payment-intent` to generate client secrets. Multi-step form with validation before proceeding to payment. Shipping cost calculated as flat $10.00 (1000 cents).