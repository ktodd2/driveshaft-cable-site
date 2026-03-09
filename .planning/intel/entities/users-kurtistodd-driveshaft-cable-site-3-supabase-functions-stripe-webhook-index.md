---
path: /Users/kurtistodd/driveshaft-cable-site-3/supabase/functions/stripe-webhook/index.ts
type: api
updated: 2026-03-09
status: active
---

# index.ts

## Purpose

Handles Stripe webhook events for payment processing. Listens for payment_intent.succeeded and payment_intent.payment_failed events to update order status and decrement inventory stock atomically.

## Exports

None (Deno Edge Function entry point using `serve()`)

## Dependencies

- Deno std/http (server.ts) - HTTP server for webhook endpoint
- Stripe SDK (esm.sh) - Webhook signature verification and event parsing
- Supabase JS Client (esm.sh) - Database operations for orders and inventory

## Used By

TBD

## Notes

- Implements idempotency check: skips processing if order already marked as 'paid' (handles Stripe's duplicate webhook delivery)
- Uses `decrement_stock` RPC function for atomic inventory updates
- Requires environment variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- Items for stock decrement are passed via paymentIntent.metadata.items as JSON string