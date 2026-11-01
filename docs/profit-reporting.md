# Profit reporting and bookkeeping export

## Findings

Verified local base: main `bbc95a26dde9037fc1c6b388fec35cc61e0cc569` (PR #16).
Dashboard passed the global blended receipt cost into `calcProfitStats`; Analytics
passed the per-product cost map. Mixed-product sales therefore had different
product costs. Both treated missing shipping as a default zero and called the
result net profit. Product filtering also recalculated the fixed Stripe fee and
selected only the first matching product line; separately rounded allocations
could lose cents. Date boundaries mixed rolling durations and local dates.

The subsequent read-only reconciliation below reproduced the exact historical
$74.74 discrepancy using current store records. Minimal financial/status fields
and sanitized item quantities/prices/product IDs were read; names, emails,
addresses and payment-intent IDs were not read. No production records changed.

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
estimated fees/contribution, uncertainty flags, recorded-status-only payment
verification, unverified test-mode status and refund/quality statuses.
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

## Current-store reconciliation — 2026-11-01

Read-only Supabase snapshot at **2026-11-01 05:55:45.885529 UTC**, project
`twrihhyfvomqiqbxkitc`. Explicit period **2026-10-03 00:00 UTC inclusive through
2026-11-02 00:00 UTC exclusive**. The snapshot precedes the period's end, so
figures are only as of the snapshot, not a forecast of the rest of the day.

There are 238 total order records and 10 receipt records. The selected period has
81 records: 60 eligible recorded-paid orders, 7,004 units; 21 pending/unpaid records
are excluded. The old paid-only filter includes the same 60 orders in this period.

| USD amount | Old Dashboard | Old Analytics | New shared calculation |
|---|---:|---:|---:|
| Order total including tax | $19,734.26 | $19,734.26 | $19,734.26 (export) |
| Tax | Included in revenue | Included in revenue | $219.76 excluded |
| Revenue excluding tax | Not separated | Not separated | $19,514.50 |
| Product cost estimate | $3,221.84 | $3,147.10 | $3,147.10 |
| Recorded shipping subtotal | $932.79 | $932.79 | $932.79 recorded; total incomplete |
| Estimated processor fees | $457.37 | $457.37 | $457.37 |
| Displayed profit/contribution | $15,122.26 | $15,197.00 | Incomplete |

The **$74.74 difference is exactly the product-cost difference**. The old blended
unit cost is 46 cents; current per-product costs range from 43 to 430 cents.
**15 included orders have null shipping costs**, none have recorded zero. Product
costs and tax/total/fee inputs are present for all 60. With fallback zero, both new
pages withhold shipping total, contribution and margin. The 45 remaining orders
have computable contribution estimates, but these do not make the full period complete.

Recorded subtotal $19,256.00 minus discounts $611.50 plus charged shipping $870.00
plus tax $219.76 equals total $19,734.26. All 60 individual orders reconcile these
components. The bookkeeping CSV round-trip preserves every source ID and amount:
60 unique rows, 15 blank actual shipping amounts and 15 blank contribution
estimates, without substituting zero. UI/download verification with this exact
snapshot passed on 1440px and 390px screens, with external requests blocked.

Across all time, there are 171 records marked paid. One $75 cancelled order
(created June 2, with null shipping) is excluded, leaving 170 eligible orders.
Thus historical all-paid missing shipping count 25 becomes **24 eligible all-time**,
while the selected 30-date period has 15. All-time eligible gross is $45,271.40,
tax $411.25, ex-tax revenue $44,860.15, estimated product cost $7,126.40, recorded
shipping subtotal $2,329.68, estimated fees $1,128.02; total contribution is incomplete.

### Boundaries and factual limitations

The old Analytics 30-day rolling interval at this snapshot starts
**2026-10-02 05:55:45.885 UTC**, ending at snapshot time. The new calendar interval
starts Oct 3 midnight and ends Nov 2 midnight. Both select exactly the same 60
paid orders in this snapshot, so the dollar difference is not caused by dates.
These definitions can differ on other snapshots. The old Dashboard used local
`setDate` (DST-sensitive); old custom start/end mixed UTC and local time. The new
UTC calendar behavior is an intentional visible change, not a claim of identical
period definitions.

The live schema has **no dedicated test-mode flags or refund timestamp/amount
columns**. Eligibility can exclude noneligible statuses but cannot identify an
unmarked test payment or unrecorded refund. UI and export now explicitly state
this uncertainty; no Stripe verification or refund reconciliation was attempted.
Live item JSON keys are only name, price, productId and quantity: no captured
historical unit cost exists there. Receipt averages remain **current estimates**,
not historically captured COGS. No order costs were fabricated or rewritten.

## Follow-up: owner-selected $15 reporting fallback (local, not yet released)

The owner's latest direction supersedes the request to fill stored costs:
“Use 15$ as fallback for not entered.” **No production order updates were executed.**
The preflight used SELECT queries only. No schema or provenance workaround is needed.

Dashboard, Analytics, product allocation, summary/PDF and bookkeeping export now
share a fixed **1,500-cent reporting fallback** whenever actual shipping is null
or absent. Existing recorded zeros and positive costs win; invalid recorded values
remain incomplete. The former browser-local editable fallback is replaced by an
explicit owner-specified $15 explanation, so stale localStorage (including zero)
cannot make two browsers or screens disagree. The rule applies to future missing
shipping too. It never updates order records or triggers notifications.

Bookkeeping preserves the blank actual_shipping_cost_cents field and puts 1500
in shipping_estimate_cents, marks shipping_cost_status=estimated and adds
shipping_estimate_source=owner_specified_reporting_fallback_not_carrier_verified.
Mixed-product allocations divide that one $15 amount with cent-preserving rounding;
they do not charge $15 again for each line/product. Missing product cost, tax/total
or unrecognized fee inputs still withhold contribution. Refund/test/payment
verification limitations remain visible. These are contribution estimates, not
verified carrier charges or net profit.

Fresh read-only source check: 2026-11-01 06:12:35 UTC. 170 eligible paid orders;
24 missing costs across all time; 146 positive recorded costs, no recorded zeros.
Excluded missing-cost records: 61 pending/unpaid, 4 pending/failed, 1 cancelled/paid.
No obvious test-name/example-domain markers among the 24 eligible missing rows;
the schema still cannot establish test mode or independently verify payment.

Projected using the fallback (no data changes):

| Metric | Last 30 UTC dates | All time |
|---|---:|---:|
| Eligible orders | 60 | 170 |
| Orders using fallback | 15 | 24 |
| Estimated shipping added | $225.00 | $360.00 |
| Recorded + estimated shipping | $1,157.79 | $2,689.68 |
| Estimated contribution | $14,752.24 | $33,916.05 |
| Estimated contribution margin | 75.6% | 75.6% |
| Orders still incomplete | 0 | 0 |

Shipping was the only missing input in these current eligible records. Source
amounts/IDs remain untouched. Unit coverage includes null/absent/zero/positive/
invalid shipping, other unknowns, repeated/mixed products, date eligibility,
future unentered shipping, export provenance and sum consistency. The full suite
now has 186 passing tests. Build and all 31 routes pass. No push or deployment of
this follow-up is authorized until the user approves the tested local change.

Follow-up desktop/mobile verification passed at 1440px and 390px with synthetic
fixtures and the fresh actual-data snapshot served only locally. Both pages show
$14,752.24 for the last 30 dates, 60 CSV rows, 15 separate $15 shipping estimates,
blank actual costs for those rows and matching source amounts. No overflow or JS
errors. Existing recorded-zero and other-incomplete cases pass.
