---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/pages/FAQPage.jsx
type: component
updated: 2026-02-26
status: active
---

# FAQPage.jsx

## Purpose

Displays a categorized FAQ (Frequently Asked Questions) page for the K.Todd Driveshaft Cable product. Provides expandable accordion-style answers organized by Product, Usage, and Ordering categories.

## Exports

- `FAQPage` (default) - React component rendering the FAQ page with collapsible question/answer sections

## Dependencies

- `react` - useState hook for managing expanded FAQ state
- `react-router-dom` - Link component for navigation to contact and quote pages

## Used By

TBD

## Notes

- Uses local `faqs` array with categorized questions/answers (not fetched from API)
- Accordion pattern with single expanded item at a time (clicking new item closes previous)
- Links to `/contact` and `/request-quote` pages within answer content