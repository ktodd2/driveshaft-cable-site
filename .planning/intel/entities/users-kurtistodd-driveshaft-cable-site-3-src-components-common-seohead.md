---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/common/SEOHead.jsx
type: component
updated: 2026-03-02
status: active
---

# SEOHead.jsx

## Purpose

Reusable SEO component that manages document head metadata using react-helmet-async. Provides consistent meta tags for search engines, Open Graph social sharing, Twitter cards, and JSON-LD structured data across all pages.

## Exports

- `SEOHead` (default): React component accepting title, description, keywords, canonical URL, OG image, noindex flag, and structured data props

## Dependencies

- react-helmet-async (external)

## Used By

TBD

## Notes

- Site constants (SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, DEFAULT_IMAGE) are hardcoded for K.Todd Driveshaft Cable branding
- Title format appends site name with separator when custom title provided
- Canonical URLs are prefixed with SITE_URL when relative path provided
- Supports noindex/nofollow for pages that shouldn't be indexed