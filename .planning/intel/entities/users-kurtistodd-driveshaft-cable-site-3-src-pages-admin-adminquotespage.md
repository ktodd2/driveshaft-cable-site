---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminQuotesPage.jsx
type: component
updated: 2026-02-27
status: active
---

# AdminQuotesPage.jsx

## Purpose

Admin dashboard page for managing customer quote requests. Displays all quotes in a table with status management, allowing admins to track and update quote statuses (new, responded, converted, declined).

## Exports

- `AdminQuotesPage` (default) - React component for the quotes management admin page

## Dependencies

- `react-router-dom` - Link, useNavigate for navigation
- `date-fns` - format for date formatting
- [[users-kurtistodd-driveshaft-cable-site-3-lib-supabase]] - supabase client for auth and database operations

## Used By

TBD

## Notes

- Requires authentication - redirects to `/admin/login` if no session
- Fetches from `quote_requests` table ordered by `created_at` descending
- Status badges use color-coded styling (yellow=new, blue=responded, green=converted, red=declined)
- Includes shared admin header and sidebar navigation pattern