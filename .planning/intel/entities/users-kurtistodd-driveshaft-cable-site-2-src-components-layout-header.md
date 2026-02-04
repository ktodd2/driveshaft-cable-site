---
path: /Users/kurtistodd/driveshaft-cable-site-2/src/components/layout/Header.jsx
type: component
updated: 2026-02-04
status: active
---

# Header.jsx

## Purpose

Provides the main navigation header component for the site with responsive mobile menu, cart item count display, and cart notification popup system. Handles navigation state and displays a temporary notification when items are added to cart.

## Exports

- `Header` (default): Main navigation header component with mobile menu toggle, nav links, and cart badge
- `CartNotification`: Popup notification component that appears when items are added to cart, with actions to view cart or continue shopping

## Dependencies

- react-router-dom (Link, useLocation)
- [[cartStore]] (useCartStore, selectTotalItems)

## Used By

TBD

## Notes

Uses Zustand store notification system for cart feedback. Notification auto-clears on route navigation or manual dismissal. Header is fixed positioned with backdrop blur effect.