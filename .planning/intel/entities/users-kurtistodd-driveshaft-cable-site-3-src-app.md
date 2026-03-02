---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/App.jsx
type: component
updated: 2026-03-02
status: active
---

# App.jsx

## Purpose

Root application component that defines the routing structure for the entire e-commerce site. Configures React Router with public customer-facing routes wrapped in a shared Layout component, and separate admin routes for the dashboard.

## Exports

- **App** (default): Main application component containing BrowserRouter, HelmetProvider, and all route definitions

## Dependencies

- react
- react-router-dom (BrowserRouter, Routes, Route)
- react-helmet-async (HelmetProvider)
- [[layout]] - Shared layout wrapper for public routes
- [[homepage]] - Landing page
- [[aboutpage]] - Company information
- [[contactpage]] - Contact form
- [[faqpage]] - Frequently asked questions
- [[notfoundpage]] - 404 error page
- [[productlistpage]] - Product catalog
- [[productdetailpage]] - Individual product view
- [[cartpage]] - Shopping cart
- [[checkoutpage]] - Payment flow
- [[ordersuccesspage]] - Order confirmation
- [[quotepage]] - Quote request form
- [[ordertrackingpage]] - Order status lookup
- [[adminloginpage]] - Admin authentication
- [[admindashboardpage]] - Admin home
- [[adminorderspage]] - Order management
- [[adminquotespage]] - Quote management
- [[adminemailpage]] - Email management
- [[adminanalyticspage]] - Analytics dashboard
- [[adminnewsletterpage]] - Newsletter management

## Used By

TBD

## Notes

- Public routes use nested routing under Layout for consistent header/footer
- Admin routes are defined outside the Layout wrapper (separate admin UI)
- Comment mentions "lazy loaded" for admin pages but imports are synchronous—potential optimization opportunity
- AdminNewsletterPage is imported but not included in the Routes (missing route definition)