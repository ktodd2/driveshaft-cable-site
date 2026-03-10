---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminBlogPage.jsx
type: component
updated: 2026-03-10
status: active
---

# AdminBlogPage.jsx

## Purpose

Admin dashboard page for managing AI-generated blog posts. Provides controls for generating new posts via Supabase edge function, toggling publish/draft status, and deleting posts, along with stats on topic seeds remaining.

## Exports

- `default` / `AdminBlogPage` - React component for the blog admin interface

## Dependencies

- react (external)
- react-router-dom (external) - `Link`, `useNavigate` for routing
- [[users-kurtistodd-driveshaft-cable-site-3-lib-supabase]] - Supabase client for auth and database operations

## Used By

TBD

## Notes

- Uses `TOTAL_TOPIC_SEEDS = 50` constant to track available AI generation topics
- Invokes `generate-blog-post` Supabase edge function for AI content generation
- Requires authenticated session; redirects to `/admin/login` if unauthenticated
- Manages post lifecycle: generate → draft → published → delete