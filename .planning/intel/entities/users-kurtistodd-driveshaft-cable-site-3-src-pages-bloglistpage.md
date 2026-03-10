---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/BlogListPage.jsx
type: component
updated: 2026-03-10
status: active
---

# BlogListPage.jsx

## Purpose

Displays a paginated, filterable list of published blog posts fetched from Supabase. Provides category filtering, pagination controls, and SEO optimization with structured data for the blog index page.

## Exports

- `BlogListPage` (default): Main page component that renders the blog listing with category filters, post cards, and pagination

## Dependencies

- [[supabase]] - Database client for fetching blog posts
- [[seohead]] - SEO meta tags and structured data component
- react-router-dom (`Link`) - Client-side navigation to individual posts
- react (`useState`, `useEffect`) - State management and data fetching

## Used By

TBD

## Notes

- Uses `POSTS_PER_PAGE` constant (12) for pagination with off-by-one in hasMore check (fetches n+1 to detect more pages)
- Category colors are hardcoded with Tailwind classes for visual differentiation
- Implements Schema.org Blog structured data for SEO
- Resets to page 0 when category filter changes