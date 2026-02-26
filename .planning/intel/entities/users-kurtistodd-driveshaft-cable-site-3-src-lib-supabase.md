---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/lib/supabase.js
type: service
updated: 2026-02-26
status: active
---

# supabase.js

## Purpose

Initializes and exports the Supabase client for database operations. Provides functions for submitting quote requests to the database and sending notification emails via Supabase Edge Functions.

## Exports

- `supabase` - Configured Supabase client instance using environment variables for URL and anon key
- `submitQuoteRequest(formData)` - Async function that inserts a quote request into the `quote_requests` table with name, company, email, phone, quantity, message, and timestamp
- `sendQuoteNotification(formData)` - Async function that invokes the `send-quote-notification` Edge Function to send email notifications for new quote requests

## Dependencies

- @supabase/supabase-js (external)

## Used By

TBD

## Notes

- Environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set; falls back to placeholder strings
- File includes SQL setup instructions in comments for creating the `quote_requests` table with RLS policies
- `submitQuoteRequest` throws on error while `sendQuoteNotification` catches and returns error object