---
path: /Users/kurtistodd/driveshaft-cable-site/src/components/QuoteForm.jsx
type: component
updated: 2025-01-20
status: active
---

# QuoteForm.jsx

## Purpose

Lead capture form component for quote requests. Manages form state for customer details (name, company, email, phone, quantity, message) and submission status (idle, submitting, success, error). Submits data to Supabase via the submitQuoteRequest service. Features value propositions alongside the form and a success confirmation state.

## Exports

- `QuoteForm` (default) - Quote request form React component with submission handling

## Dependencies

- react - Core React library with useState hook for form and status state
- [[src-lib-supabase]] - Provides submitQuoteRequest function for database submission

## Used By

TBD
