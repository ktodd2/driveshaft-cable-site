---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/HomePage.jsx
type: component
updated: 2026-03-02
status: active
---

# HomePage.jsx

## Purpose

Main landing page component that assembles all marketing sections for the driveshaft cable e-commerce site. Combines SEO metadata with structured data for organization schema and renders the complete sales funnel from hero through quote form.

## Exports

- `HomePage` (default) - Landing page component rendering all marketing sections with SEO head

## Dependencies

- react (external)
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-landing-hero]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-landing-problem]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-landing-productshowcase]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-landing-specs]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-landing-howitworks]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-landing-customers]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-landing-quoteform]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-common-seohead]]

## Used By

TBD

## Notes

- Contains inline `homeStructuredData` object for JSON-LD Organization schema markup
- Section order follows a marketing funnel: Hero → Problem → Product → Specs → How It Works → Social Proof → CTA
- Uses fragment wrapper (`<>`) to avoid extra DOM nodes