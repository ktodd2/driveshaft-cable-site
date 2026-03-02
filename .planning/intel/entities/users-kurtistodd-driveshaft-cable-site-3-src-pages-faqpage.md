---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/FAQPage.jsx
type: component
updated: 2026-03-02
status: active
---

# FAQPage.jsx

## Purpose

Renders the FAQ page with an accordion-style interface for frequently asked questions about the K.Todd Driveshaft Cable product. Includes SEO-optimized structured data (JSON-LD FAQPage schema) for rich search results.

## Exports

- `FAQPage` (default): React component that displays expandable FAQ sections with product information, specifications, installation instructions, and ordering details.

## Dependencies

- `react` (external): useState hook for accordion state management
- `react-router-dom` (external): Link component for internal navigation
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]]: SEOHead component for meta tags and structured data injection

## Used By

TBD

## Notes

- Uses JSON-LD structured data (`FAQPage` schema) for SEO, injected via SEOHead component
- Accordion state managed locally with useState (single open section at a time)
- FAQ content covers: product description, vehicle compatibility, specifications, single-use design, installation, tow setup compatibility, sizing, bulk orders, warranty, and purchasing
- Responsive design with mobile-friendly tap targets for accordion headers