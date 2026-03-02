---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/layout/Layout.jsx
type: component
updated: 2026-03-02
status: active
---

# Layout.jsx

## Purpose

Root layout wrapper component that provides consistent page structure including announcement bar, header, main content area, and footer. Wraps all routed pages via React Router's Outlet and includes the newsletter modal overlay.

## Exports

- **Layout** (default): Main layout component that renders the full page shell with dark background, announcement bar, header, footer, and newsletter modal

## Dependencies

- react
- react-router-dom (Outlet)
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-layout-header]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-layout-footer]]
- [[users-kurtistodd-driveshaft-cable-site-3-src-components-newsletter-newslettermodal]]

## Used By

TBD

## Notes

- Announcement bar displays shipping promotions (free over $100, $10 flat rate under)
- Uses flexbox column layout with `min-h-screen` to ensure footer stays at bottom
- NewsletterModal renders at layout level so it's available on all pages