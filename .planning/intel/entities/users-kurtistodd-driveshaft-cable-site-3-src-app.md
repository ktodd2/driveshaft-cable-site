---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/App.jsx
type: component
updated: 2026-03-10
status: active
---

# App.jsx

## Purpose

Root application component that defines the routing structure for the driveshaft cable e-commerce site. Configures public routes within a shared Layout, admin routes with lazy loading for code splitting, and wraps the app with HelmetProvider for SEO meta tag management.

## Exports

- `App` (default): Main application component containing BrowserRouter, route definitions, and provider wrappers

## Dependencies

**External:**
- react (Suspense, lazy)
- react-router-dom (BrowserRouter, Routes, Route)
- react-helmet-async (HelmetProvider)

**Internal:**
- [[layout]] - Layout wrapper component
- [[homepage]] - Landing page
- [[aboutpage]] - About page
- [[contactpage]] - Contact form page
- [[faqpage]] - FAQ page
- [[notfoundpage]] - 404 page
- [[productlistpage]] - Product catalog
- [[productdetailpage]] - Individual product view
- [[cartpage]] - Shopping cart
- [[checkoutpage]] - Checkout flow
- [[ordersuccesspage]] - Order confirmation
- [[quotepage]] - Quote request form
- [[ordertrackingpage]] - Order status lookup
- [[bloglistpage]] - Blog listing
- [[blogpostpage]] - Individual blog post
- [[adminloginpage]] - Admin authentication (lazy)
- [[admindashboardpage]] - Admin dashboard (lazy)
- [[adminorderspage]] - Order management (lazy)
- [[adminquotespage]] - Quote management (lazy)
- [[adminemailpage]] - Email campaigns (lazy)
- [[adminanalyticspage]] - Analytics dashboard (lazy)
- [[adminnewsletterpage]] - Newsletter management (lazy)

## Used By

TBD

## Notes

- Admin routes are lazy-loaded using React.lazy() to exclude them from the public bundle, improving initial load performance
- Blog routes (`/blog`, `/blog/:slug`) appear to be missing from the Route definitions despite importing BlogListPage and BlogPostPage
- Public routes use nested routing under Layout for consistent header/footer
- Admin routes are defined outside the Layout to have their own UI structure