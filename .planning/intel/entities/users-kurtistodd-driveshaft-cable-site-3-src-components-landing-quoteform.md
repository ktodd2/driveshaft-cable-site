---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/landing/QuoteForm.jsx
type: component
updated: 2026-02-26
status: active
---

# QuoteForm.jsx

## Purpose

A landing page contact form component that allows users to request quotes for the K.Todd Driveshaft Cable product. Handles form state, validation, submission to Supabase, and displays success/error feedback.

## Exports

- `QuoteForm` (default): React component rendering a quote request form with fields for name, company, email, phone, quantity, and message

## Dependencies

- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]]: `submitQuoteRequest`, `sendQuoteNotification`
- react: `useState`

## Used By

TBD

## Notes

- Form has four states: `idle`, `submitting`, `success`, `error`
- Quantity field is parsed to integer before submission, with null fallback for empty values
- `sendQuoteNotification` is imported but not currently used in the visible code (may be used in truncated portion)
- Styled with Tailwind CSS using custom `ktodd-dark` and `ktodd-charcoal` color tokens