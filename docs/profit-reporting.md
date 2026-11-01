# Profit reporting and bookkeeping export

## Findings

Verified local base: main `bbc95a26dde9037fc1c6b388fec35cc61e0cc569` (PR #16).
Dashboard passed the global blended receipt cost into `calcProfitStats`; Analytics
passed the per-product cost map. Mixed-product sales therefore had different
product costs. Both treated missing shipping as a default zero and called the
result net profit. Product filtering also recalculated the fixed Stripe fee and
selected only the first matching product line; separately rounded allocations
could lose cents. Date boundaries mixed rolling durations and local dates.

This code inspection explains the discrepancy mechanism. It does not independently
reproduce the historical $74.74 difference or verify today's production totals.
No live customer data was downloaded or mutated during this implementation.

## Reporting contract

- Both pages use per-product current weighted receipt averages, rounded to cents
  per unit. These estimates can change when receipts change; no historical COGS
  snapshots are created or rewritten. Invalid receipts make that product unknown.
- Contribution = order total less tax, estimated product costs, recorded or
  explicitly estimated shipping, and estimated processing fees. Order total
  already includes discounts and charged shipping; these are not subtracted twice.
- Missing/invalid tax or total, missing product costs, unknown shipping, or an
  unsupported payment method with unknown fees withhold contribution and margin.
  Unknown costs are blank in bookkeeping CSV. Recorded zero shipping is valid.
- Existing positive browser-local shipping fallback is an explicit estimate only;
  zero means unknown. It never updates order records. Cost totals are also withheld when any included cost is unknown.
- Stripe/legacy-null method estimates 2.9% + $0.30; cash/Zelle/CashApp assume zero
  fees. These are not Stripe reconciliation or verified net profit. Refunds,
  returns, fees and operating expenses need separate reconciliation.
- Eligibility reuses the Needs attention rule: payment_status=paid and status
  confirmed/shipped/delivered; exclude known tests, refund timestamps/positive
  refunded amounts, and all other statuses (including closed/cancelled/refunded).
  This is recorded status, not independent payment verification. Partial refunds
  with recorded positive amounts are conservatively excluded, not netted.
- UTC calendar dates use created_at, not paid/settlement date. Last 30 days means
  today and the prior 29 UTC dates; other day ranges follow the same rule, year
  means 365 dates. Custom dates include the entire end date (exclusive next
  midnight), and either endpoint can be omitted. Invalid/reversed dates are empty.
- Product views group repeated lines and allocate order-level amounts by line
  value, or units for zero-value carts. Largest remainder allocation preserves
  integer cents, including fixed processing fees. Unknown costs propagate.
- Orders and receipts are paginated using the existing shared reader. A failed
  page withholds reports and exports instead of displaying partial success.
  Reload to refresh source data. Retired/unknown products remain visible.

## Export

Analytics offers **Bookkeeping CSV (whole orders)** alongside the existing
summary CSV and PDF. It follows selected dates and eligibility, always including
whole orders across all products; the product chart filter cannot create partial
ledger entries. One row per stable order ID, USD integer cents, no customer PII:
created timestamp, statuses/method, subtotal, discount, shipping charged, tax,
total, ex-tax revenue, units, estimated product costs, actual/estimated shipping,
estimated fees/contribution, uncertainty flags and refund/quality statuses.
Missing values are blank, recorded zero is 0. Empty results still have headers.
All text cells are neutralized for spreadsheet formulas, including leading
whitespace and control characters. Existing summary CSV also receives this
protection. This is review material, not an accounting submission or complete
refund ledger.

## Verification

- `npm test`: 184 passing tests, including 7 new reporting cases.
- `npm run build`: passes. Existing bundle-size/Browserslist warnings remain;
  local sitemap skips blog fetching without production environment credentials.
- `npm run routes:check`: all 31 routes pass.
- `git diff --check`: passes. No separate typecheck script exists in this JSX repo.
- `tests/browser/profitReporting.mjs`: synthetic data, all external traffic blocked;
  1440px desktop and 390px mobile, both actual pages. Checks matching $6.34 complete
  contribution, missing vs zero shipping, $4.34 explicit shipping estimate,
  product filtering, CSV contents, PDF generation, empty states, order/receipt
  failures, JS errors and horizontal overflow. Existing Needs attention and
  shipping import panels are stubbed in this focused reporting harness; their
  unit/regression tests remain in the full suite.

Run Vite on local port 3012, then set REPORT_PLAYWRIGHT_MODULE to a Playwright
module and optionally REPORT_BROWSER to a browser executable and run:
`node tests/browser/profitReporting.mjs`.

## Release

Local implementation only. No schema migration, security/credential changes,
external subscription, record writes, emails, pushes, PR, merge or deployment.
Publishing requires new explicit approval. After approved release, compare both
pages with the same UTC dates, all products, shipping estimate and freshly loaded
sources; verify the export under the real admin account read-only. Do not claim
live financial reconciliation from fixture tests.

Recommended defaults are the conservative rules above. A business-local timezone,
historical COGS methodology, verified processor fees and refund ledger would be
separate future decisions, not assumptions silently introduced here.
