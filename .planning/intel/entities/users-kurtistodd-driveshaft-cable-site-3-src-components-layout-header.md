---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/layout/Header.jsx
type: component
updated: 2026-03-10
status: active
---

# Header.jsx

## Purpose

Main navigation header component for the e-commerce site. Provides fixed-position navigation with cart integration, mobile-responsive menu, and a toast notification system for cart additions.

## Exports

- `Header` (default): Main header component with navigation links, logo, cart icon with item count badge, and mobile hamburger menu
- `CartNotification`: Internal component displaying animated toast notifications when items are added to cart

## Dependencies

- react-router-dom (Link, useLocation)
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]] (useCartStore, selectTotalItems)

## Used By

TBD

## Notes

- Uses Zustand cart store for reactive cart item count and notification state
- Fixed positioning with backdrop blur and dark theme styling
- Mobile menu implemented with hamburger toggle (isMenuOpen state)
- Cart notification auto-dismisses and provides "View Cart" / "Continue Shopping" actions
- NavLink internal component handles active state styling and menu close on navigation