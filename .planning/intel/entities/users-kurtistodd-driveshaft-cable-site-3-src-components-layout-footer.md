---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/layout/Footer.jsx
type: component
updated: 2026-03-02
status: active
---

# Footer.jsx

## Purpose

Site-wide footer component that displays brand information, navigation links (Shop, Company sections), contact details, and a newsletter signup form. Provides consistent bottom-of-page navigation and company information across all pages.

## Exports

- `Footer` (default): React functional component rendering the site footer with brand, navigation links, contact info, and newsletter signup

## Dependencies

- react (external)
- react-router-dom (external - Link component for internal navigation)
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-newsletter-newsletterform]] (internal - newsletter subscription form)

## Used By

TBD

## Notes

- Uses industrial/heavy-duty visual styling with caution stripe, dark background, and yellow accent colors matching brand identity
- Dynamically calculates current year for copyright notice
- Contact section includes email and phone links for direct customer contact
- Grid layout with 4 columns on desktop, responsive stacking on mobile