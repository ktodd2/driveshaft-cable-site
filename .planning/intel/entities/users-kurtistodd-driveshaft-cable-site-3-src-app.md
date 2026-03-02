---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/App.jsx
type: component
updated: 2026-03-02
status: active
---

# App.jsx

## Purpose

Root application component that defines the routing structure for the entire e-commerce site. It configures both public customer-facing routes (wrapped in a shared Layout) and admin dashboard routes.

## Exports

- **App** (default): Main application component containing BrowserRouter and all route definitions

## Dependencies

- react
- react-router-dom (BrowserRouter, Routes, Route)
- react-helmet-async (HelmetProvider - imported but unused)
- [[Layout]]: Shared layout wrapper for public routes
- [[HomePage]]: Landing page
- [[AboutPage]]: About page
- [[ContactPage]]: Contact page
- [[FAQPage]]: FAQ page
- [[NotFoundPage]]: 404 fallback
- [[ProductListPage]]: Product catalog
- [[ProductDetailPage]]: Individual product view (dynamic :slug)
- [[CartPage]]: Shopping cart
- [[CheckoutPage]]: Checkout flow
- [[OrderSuccessPage]]: Post-purchase confirmation
- [[QuotePage]]: Quote request form
- [[OrderTrackingPage]]: Order status tracking
- [[AdminLoginPage]]: Admin authentication
- [[AdminDashboardPage]]: Admin home
- [[AdminOrdersPage]]: Order management
- [[AdminQuotesPage]]: Quote management
- [[AdminEmailPage]]: Email administration
- [[AdminAnalyticsPage]]: Analytics dashboard

## Used By

TBD

## Notes

- Comment mentions "lazy loaded" for admin pages but they're actually imported statically
- HelmetProvider is imported but not used in the JSX tree
- Admin routes are outside the Layout wrapper, meaning they don't share the public site's header/footer
- Public routes use nested routing with Layout as parent; admin routes are flat