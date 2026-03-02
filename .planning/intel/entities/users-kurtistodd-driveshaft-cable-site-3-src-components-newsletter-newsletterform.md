---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/newsletter/NewsletterForm.jsx
type: component
updated: 2026-03-02
status: active
---

# NewsletterForm.jsx

## Purpose

A reusable email subscription form component that captures newsletter signups and stores them in Supabase. Handles form state, validation, duplicate email detection (treating duplicates as success), and provides visual feedback for submission states.

## Exports

- `default` / `NewsletterForm` - React form component accepting `source` (string for tracking signup origin), `onSuccess` (callback), and `compact` (boolean for layout variant) props

## Dependencies

- [[supabase]] - Database client for inserting subscriber records
- `react` - useState for form state management

## Used By

TBD

## Notes

- Duplicate email constraint violations (Postgres error code 23505) are intentionally treated as successful signups to avoid revealing existing subscriptions
- The `source` prop enables tracking where signups originate (defaults to 'homepage')
- Two layout modes: standard (stacked on mobile, row on desktop) and compact (always row)