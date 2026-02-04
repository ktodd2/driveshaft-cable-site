---
path: /Users/kurtistodd/driveshaft-cable-site-2/supabase/functions/stripe-webhook/index.ts
type: api
updated: 2026-02-04
status: active
---

# index.ts

## Purpose

Deno Edge Function that handles Stripe webhook events to process payment confirmations and failures. Updates order payment status in Supabase database when payment intents succeed or fail.

## Exports

None

## Dependencies

- https://deno.land/std@0.168.0/http/server.ts
- https://esm.sh/stripe@13.10.0?target=deno
- https://esm.sh/@supabase/supabase-js@2

## Used By

TBD

## Notes

Verifies webhook signatures using STRIPE_WEBHOOK_SECRET. Handles `payment_intent.succeeded` and `payment_intent.payment_failed` events. Uses service role key for privileged database access. Requires environment variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.