---
path: /Users/kurtistodd/driveshaft-cable-site-3/supabase/functions/send-marketing-email/index.ts
type: api
updated: 2026-02-27
status: active
---

# index.ts

## Purpose

Supabase Edge Function that sends marketing emails to customers. Supports both manual sends (with subject/htmlContent) and scheduled campaign sends (via campaignId lookup), collecting recipients from paid orders and quote requests.

## Exports

None (Edge Function entry point)

## Dependencies

- https://deno.land/std@0.168.0/http/server.ts (serve function)
- https://esm.sh/@supabase/supabase-js@2 (Supabase client)
- Resend API (external email service)
- Environment: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

## Used By

TBD

## Notes

- Handles CORS preflight requests
- Aggregates unique emails from `orders` (paid only) and `quote_requests` tables
- Sends emails individually via Resend API with tracking of sent/failed counts
- Campaign mode fetches email content from `email_campaigns` table