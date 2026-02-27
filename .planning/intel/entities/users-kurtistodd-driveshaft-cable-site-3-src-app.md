---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/App.jsx
type: component
updated: 2026-02-27
status: active
---

# App.jsx

## Purpose

Root application component that configures client-side routing for the entire application. Defines the route structure for both public-facing pages and admin dashboard pages using React Router.

## Exports

- **App** (default): Main application component with BrowserRouter and route configuration

## Dependencies

- react (external)
- react-router-dom (external)
- [[components-layout-layout]]: Shared layout wrapper for public routes
- [[pages-homepage]]: Landing page
- [[pages-aboutpage]]: About page
- [[pages-contactpage]]: Contact form page
- [[pages-faqpage]]: FAQ page
- [[pages-notfoundpage]]: 404 fallback page
- [[pages-productlistpage]]: Product catalog listing
- [[pages-productdetailpage]]: Individual product view
- [[pages-cartpage]]: Shopping cart
- [[pages-checkoutpage]]: Checkout flow
- [[pages-ordersuccesspage]]: Order confirmation
- [[pages-quotepage]]: Quote request form
- [[pages-ordertrackingpage]]: Order status tracking
- [[pages-admin-adminloginpage]]: Admin authentication
- [[pages-admin-admindashboardpage]]: Admin dashboard
- [[pages-admin-adminorderspage]]: Order management
- [[pages-admin-adminquotespage]]: Quote management
- [[pages-admin-adminemailpage]]: Email marketing (imported but not routed)

## Used By

TBD

## Notes

- AdminEmailPage is imported but not included in the route configuration - appears to be a missing route
- Comment mentions "lazy loaded" for admin pages but they use standard imports, not React.lazy()
- Public routes are nested under Layout component; admin routes are standalone