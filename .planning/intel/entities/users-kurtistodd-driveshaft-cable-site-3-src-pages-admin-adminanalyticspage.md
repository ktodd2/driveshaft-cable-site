---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminAnalyticsPage.jsx
type: component
updated: 2026-02-28
status: active
---

# AdminAnalyticsPage.jsx

## Purpose

Admin dashboard page for viewing financial analytics and order metrics. Displays revenue, profit, shipping costs, and Stripe fees through interactive charts with configurable date ranges.

## Exports

- `AdminAnalyticsPage` (default): Main analytics dashboard component with charts for revenue trends, profit margins, and cost breakdowns

## Dependencies

- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-supabase]]: Database client for auth and order queries
- [[users-kurtistodd-driveshaft-cable-site-3-src-stores-cartstore]]: `formatPrice` utility for currency display
- [[users-kurtistodd-driveshaft-cable-site-3-src-hooks-useproductshipments]]: Hook for shipment data and average cost per unit
- [[users-kurtistodd-driveshaft-cable-site-3-src-lib-costcalculations]]: `calcOrderProfit` for profit calculations
- react-router-dom: Navigation and routing
- papaparse: CSV parsing for data import
- recharts: Chart components (LineChart, BarChart, PieChart, AreaChart)

## Used By

TBD

## Notes

- Uses localStorage for persisting fallback shipping cost setting (`ktodd-admin-shipping-fallback`)
- Requires authentication; redirects to `/admin/login` if no session
- Fetches only paid orders for analytics
- Custom tooltip components for currency and count display formatting
- Color palette defined in COLORS constant for consistent chart styling