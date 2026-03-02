---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/NotFoundPage.jsx
type: component
updated: 2026-03-02
status: active
---

# NotFoundPage.jsx

## Purpose

Displays a branded 404 error page when users navigate to non-existent routes. Provides clear navigation options to return to the homepage or browse products.

## Exports

- **NotFoundPage** (default): React component rendering the 404 page with industrial-themed styling, SEO head with noindex directive, and navigation links

## Dependencies

- react (external)
- react-router-dom (external)
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]] (SEOHead component)

## Used By

TBD

## Notes

- Uses `noindex` prop on SEOHead to prevent search engines from indexing the 404 page
- Follows the site's industrial/automotive design theme with yellow-500 accent color and font-industrial typography
- Responsive layout with mobile-first approach using sm: breakpoints