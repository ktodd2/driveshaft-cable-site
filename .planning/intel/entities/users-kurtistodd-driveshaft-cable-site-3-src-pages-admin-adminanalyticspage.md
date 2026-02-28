---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/admin/AdminAnalyticsPage.jsx
type: component
updated: 2026-02-28
status: active
---

# AdminAnalyticsPage.jsx

## Purpose

Admin dashboard page for visualizing sales analytics with interactive charts showing revenue, profit margins, order counts, and cost breakdowns over configurable date ranges.

## Exports

- `AdminAnalyticsPage` (default) - Main analytics dashboard component with auth protection, date range filtering, and multiple chart visualizations (line, bar, pie, area charts)

## Dependencies

- [[supabase]] - Authentication and order data fetching
- [[cartStore]] - `formatPrice` utility for currency formatting
- react-router-dom - Navigation and routing (`Link`, `useNavigate`)
- recharts - Chart components (LineChart, BarChart, PieChart, AreaChart, etc.)

## Used By

TBD

## Notes

- Requires admin authentication; redirects to `/admin/login` if not authenticated
- Cost per unit and shipping cost values persist to localStorage with `ktodd-admin-` prefix
- Only displays orders with `payment_status: 'paid'`
- Custom tooltip components (`CustomTooltip`, `CountTooltip`) for chart hover states
- Color palette defined in `COLORS` constant for consistent chart theming