---
path: /Users/kurtistodd/driveshaft-cable-site-3/supabase/functions/create-payment-intent/index.ts
type: api
updated: 2026-03-09
status: active
---

# index.ts

## Purpose

Supabase Edge Function that creates Stripe PaymentIntents for checkout. Validates product inventory stock levels before allowing payment creation to prevent overselling.

## Exports

None (Edge Function entry point using `serve()`)

## Dependencies

- deno.land/std@0.168.0/http/server.ts (HTTP server)
- stripe@13.10.0 (Stripe SDK for Deno)
- @supabase/supabase-js@2 (Supabase client)
- Environment: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

## Used By

TBD

## Notes

- Uses service role key for admin-level database access to check inventory
- Returns `clientSecret` for frontend Stripe Elements integration
- Stock validation occurs before PaymentIntent creation, not atomically with order placement
- CORS headers allow all origins (`*`) - suitable for client-side checkout calls
- Error messages appear incomplete in source (empty template literals at lines 38 and 44)