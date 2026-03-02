---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/ContactPage.jsx
type: component
updated: 2026-03-02
status: active
---

# ContactPage.jsx

## Purpose

Contact form page that allows users to submit inquiries. Stores messages in Supabase `contact_messages` table and displays company contact information including email, phone, and business hours.

## Exports

- `ContactPage` (default) - React component rendering contact form with hero section and contact details

## Dependencies

- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]] - Database client for storing contact messages
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]] - SEO metadata component
- react - useState for form state management

## Used By

TBD

## Notes

- Form state managed via `status` field: 'idle' | 'submitting' | 'success' | 'error'
- Resets form fields on successful submission
- Uses industrial/mechanical design theme consistent with site branding (yellow-500 accent, dark backgrounds)