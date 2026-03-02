---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminNewsletterPage.jsx
type: component
updated: 2026-03-02
status: active
---

# AdminNewsletterPage.jsx

## Purpose

Admin dashboard page for managing newsletter subscribers. Provides functionality to view, filter, search, unsubscribe/resubscribe, delete subscribers, and export active subscribers to CSV.

## Exports

- `AdminNewsletterPage` (default): React component rendering the newsletter subscriber management interface

## Dependencies

- [[users-kurtistodd-driveshaft-cable-site-3-lib-supabase]]: Database client for subscriber CRUD operations
- react-router-dom: Navigation and routing (Link, useNavigate)
- date-fns: Date formatting utilities
- papaparse: CSV generation for export functionality

## Used By

TBD

## Notes

- Requires admin authentication; redirects to `/admin/login` if no session exists
- Supports three filter states: all, active, unsubscribed
- CSV export only includes active subscribers with email, source, and subscribed_at fields
- Uses confirmation dialog before permanent deletion
- Calculates stats for active count, total count, and source breakdown