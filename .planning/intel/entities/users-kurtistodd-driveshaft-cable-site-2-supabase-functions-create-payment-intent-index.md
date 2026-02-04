---
path: /Users/kurtistodd/driveshaft-cable-site-2/supabase/functions/create-payment-intent/index.ts
type: api
updated: 2026-02-04
status: active
---

# index.ts

## Purpose

Supabase Edge Function that creates Stripe payment intents for processing payments. Accepts order details (amount, orderId, customerEmail) and returns a client secret for completing the payment on the frontend.

## Exports

None

## Dependencies

- https://deno.land/std@0.168.0/http/server.ts (serve)
- https://esm.sh/stripe@13.10.0 (Stripe SDK for Deno)

## Used By

TBD

## Notes

- Requires STRIPE_SECRET_KEY environment variable
- Implements CORS headers for cross-origin requests
- Amounts are expected in cents
- Payment metadata includes order_id for tracking
- Sends receipt emails to customers via Stripe