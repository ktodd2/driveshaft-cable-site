---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/App.jsx
type: component
updated: 2026-02-28
status: active
---

# App.jsx

## Purpose

Root application component that configures React Router and defines all application routes. Serves as the entry point for the SPA, organizing routes into public (wrapped in Layout) and admin sections.

## Exports

- **App** (default): Main application component containing BrowserRouter and route definitions

## Dependencies

### External
- react
- react-router-dom (BrowserRouter, Routes, Route)

### Internal
- [[layout]] - Layout wrapper for public routes
- [[homepage]] - Landing page
- [[aboutpage]] - About page
- [[contactpage]] - Contact page
- [[faqpage]] - FAQ page
- [[notfoundpage]] - 404 fallback
- [[productlistpage]] - Product catalog
- [[productdetailpage]] - Individual product view
- [[cartpage]] - Shopping cart
- [[checkoutpage]] - Checkout flow
- [[ordersuccesspage]] - Order confirmation
- [[quotepage]] - Quote request form
- [[ordertrackingpage]] - Order status tracking
- [[adminloginpage]] - Admin authentication
- [[admindashboardpage]] - Admin home
- [[adminorderspage]] - Order management
- [[adminquotespage]] - Quote management
- [[adminemailpage]] - Email campaigns
- [[adminanalyticspage]] - Analytics dashboard (imported but not routed)

## Used By

TBD

## Notes

- AdminAnalyticsPage is imported but not included in routes - appears to be incomplete integration
- Admin pages comment mentions "lazy loaded" but uses regular imports
- Public routes use nested routing with Layout; admin routes are standalone
- Product detail uses dynamic `:slug` parameter