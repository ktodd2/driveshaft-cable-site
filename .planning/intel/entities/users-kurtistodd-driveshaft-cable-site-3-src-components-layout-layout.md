---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/layout/Layout.jsx
type: component
updated: 2026-02-26
status: active
---

# Layout.jsx

## Purpose

Root layout component that wraps all pages with consistent structure including announcement bar, header, main content area, and footer. Provides the visual shell and navigation context for the entire application.

## Exports

- `Layout` (default): Main layout wrapper component using React Router's Outlet for nested route rendering

## Dependencies

- react (external)
- react-router-dom (external)
- [[header]] - Site header/navigation component
- [[footer]] - Site footer component

## Used By

TBD

## Notes

- Contains promotional announcement bar with shipping thresholds ($100 free shipping, $10 flat rate under $100)
- Uses Tailwind CSS with custom `bg-ktodd-dark` color class
- Flexbox layout ensures footer stays at bottom via `min-h-screen` and `flex-grow` on main