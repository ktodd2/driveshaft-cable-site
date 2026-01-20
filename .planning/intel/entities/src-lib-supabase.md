---
path: /Users/kurtistodd/driveshaft-cable-site/src/lib/supabase.js
type: service
updated: 2025-01-20
status: active
---

# supabase.js

## Purpose

Supabase client configuration and quote submission service. Initializes the Supabase client with environment variables and provides a function to submit quote requests to the database. Includes SQL schema documentation for the quote_requests table setup.

## Exports

- `supabase` - Configured Supabase client instance for database operations
- `submitQuoteRequest(formData): Promise<data>` - Submits a quote request to the quote_requests table, returns inserted record

## Dependencies

- @supabase/supabase-js - Supabase JavaScript client for database operations

## Used By

TBD

## Notes

Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables. Contains commented SQL for creating the quote_requests table with RLS policies.
