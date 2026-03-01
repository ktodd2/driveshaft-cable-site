---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/CheckoutPage.jsx
type: component
updated: 2026-03-01
status: active
---

# CheckoutPage.jsx

## Purpose

Handles the complete checkout flow including customer information collection, Stripe payment processing, and order creation. Manages the multi-step process from cart review through payment confirmation with real-time validation.

## Exports

- `CheckoutPage` (default): Main checkout page component with Stripe Elements integration, customer form, order summary, and payment processing

## Dependencies

- [[cartStore]]: Cart state management, pricing selectors, and utility functions
- [[supabase]]: Database client for order creation and stock management
- react-router-dom: Navigation and routing
- @stripe/stripe-js: Stripe SDK initialization
- @stripe/react-stripe-js: React components for Stripe payment elements

## Used By

TBD

## Notes

- Uses Stripe PaymentElement for PCI-compliant card collection
- Creates order record in Supabase before payment, updates status after successful payment
- Decrements inventory stock after successful payment
- Handles both redirect and non-redirect payment flows
- Contains nested `PaymentForm` component for Stripe Elements context