# Inventory planning — local review

Implemented on main `e4aff27` (PR #18, owner-selected $15 reporting-only shipping fallback). No repository AGENTS.md or local skill instructions were present. No changes to homepage, existing stock/receipt writes, cost calculations, attention queues, shipping reconciliation or quotes.

## Behavior

The admin dashboard adds inventory runway and a separate incoming planning panel. Sales windows are 7/30/90 **completed UTC days**, filtered by recorded paid and confirmed/shipped/delivered status, attributed by exact item `productId`. The legacy Cable + product `2` is not treated as XL. Units are sold catalog units (for a pack product, a unit is one pack).

Runway uses current stock / observed units per day. Missing stock and no observed sales show unknown runway. Zero/negative stock, low-volume history and malformed sales data are highlighted. Supplier lead time and safety days start blank, are configurable 0–730 whole days, and are explicitly assumptions. Reorder point is ceil(rate × (lead + safety)). Incoming quantities never suppress reorder warnings. Plans warn if present stock runs out on/before the latest estimate, or if ETA is unknown/overdue.

Orders are dated by creation time because no paid timestamp exists in the current schema. Cancelled/refunded payment statuses and ineligible order statuses are excluded. The pure model also excludes explicit test/refund flags when provided, but the live orders schema has no test/refund-history columns; this limitation is visible. Historical availability is unavailable, so the UI explicitly warns that stockouts censor demand. These are observations, not a demand model or replenishment guarantee.

All reads must succeed before forecasts display. Inventory reads fail closed at the default row cap. Orders, products and receipts are paginated. Data older than 15 minutes is withheld until refresh (checked every 30 seconds). Only identifiers, product names, quantities, dates, line items and statuses are selected; no customer contact fields are requested.

Plans support explicit shared saves after the prepared migration is approved and installed. Browser drafts remain optional device-only backups. See the persistence/security scope below.

## Proposed owner shipment — review only

`proposed-incoming.json` contains the exact proposed record, not imported by production code:

- Reference: `owner-proposed-2026-11-01` (internal proposed reference, not a supplier PO number).
- Regular, product `1`, 4.0 × 1000 mm: 10,000 units × $0.42 = $4,200.
- XL, product `driveshaft-cable-xl`, 4.0 × 1500 mm: 5,000 units × $0.55 = $2,750.
- Total product quote $6,950. Currency code, freight, duties, landed cost, payment and receipt unverified.
- Estimated December 1–16, 2026 from the owner's November 1 estimate of 30–45 days; not a carrier ETA.
- No receipt links; no actual-stock or weighted-cost effect.

Read-only production inspection on November 1 found 10,120 regular and 1,700 XL on hand. Existing receipts include a regular 10,000-unit receipt dated October 14 with total_cost_cents 410000 and an XL 2,800-unit receipt the same day. These are possible records for owner review, **not verified matches** to the new shipment. No link or duplicate assumption was made. All ten existing receipt rows were inspected using only id, product_id, quantity, total_cost_cents and received_at.

## Validation

- `npm test`: 195 passing (186 existing + 9 planning/storage tests).
- `npm run build`: passed; existing chunk-size warning. Offline build intentionally skips live blog sitemap lookup.
- `npm run routes:check`: all 31 declared routes pass.
- `tests/browser/inventoryPlanning.mjs`: passed at 1440px and 390px. Exercises controls, runway, partial receipts, persistence, duplicate lines, stale/error/loading states, no horizontal overflow or uncaught browser errors. All external requests blocked.
- `tests/browser/profitReporting.mjs`: both dashboard and analytics pass at 1440px and 390px, including shipping estimates, CSV/PDF, product filtering and unavailable-data states. Alert locator narrowed to the reporting message because the new independent panel can also report unavailable data.
- Mobile screenshot visually reviewed. Screenshots: `/tmp/inventory-1440.png`, `/tmp/inventory-390.png`.
- `git diff --check`: clean.

Browser tests use Playwright (temporary install outside the repository):

```sh
npm run dev -- --host 127.0.0.1 --port 3012
REPORT_PLAYWRIGHT_MODULE=/tmp/inventory-browser-qa/node_modules/playwright/index.mjs REPORT_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tests/browser/inventoryPlanning.mjs
REPORT_PLAYWRIGHT_MODULE=/tmp/inventory-browser-qa/node_modules/playwright/index.mjs REPORT_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tests/browser/profitReporting.mjs
```

## Shared persistence and release scope

Shared settings and incoming plans are now implemented locally. The dashboard offers **Fetch shared plan**, a preview and explicit replacement of the editor (with a recovery backup), and **Save shared plan**. Browser save/load remain separately labeled device-only backups, not substitutes for successful server storage. No shared version can be saved until it is fetched and loaded. Edits are never replaced automatically. A failed backup prevents replacement. Unsaved editor work triggers the browser's leave warning where supported.

Migration: `supabase/migrations/20261101020000_inventory_planning.sql`, prepared and tested only, **not applied**.

Exact scope:

- `inventory_planning_state`: one singleton row containing revision, a JSON plan/settings document, timestamp and actor UUID. Migration seeds only an empty 30-day plan with blank lead/safety settings; no real shipment.
- `inventory_planning_requests`: request UUID, actor UUID, expected revision, saved document, resulting revision and timestamp. Acts as retry ledger and version history; no automatic purge.
- RLS enabled on both tables. All table privileges revoked from PUBLIC, anon and authenticated. No direct client table reads or writes; no broadening of existing table policies.
- `get_inventory_plan()` and `save_inventory_plan(uuid,integer,jsonb)` are the only client access path. SECURITY DEFINER with fixed search path; execute revoked from PUBLIC/anon, granted to authenticated. Both independently require `auth.uid()` to match an `admin_users` row with `is_active IS TRUE` on every request. A merely authenticated user cannot access plans.
- Save locks the singleton row, checks expected revision, validates the complete document, then saves document + retry receipt atomically. Stable UUID line IDs and case/space-normalized reference/product uniqueness prevent duplicate lines. Receipt UUIDs must exist, match the product, be positive, not exceed planned quantity and appear at most once across the document. Receipt rows are read-locked during validation.
- Request UUID reuse with different actor/content/revision is rejected. Exact retries return the original saved revision and current revision; retrying an old successful request cannot overwrite a newer plan. Unknown transport outcomes retain the exact pending request, lock editor controls and offer an explicit retry. Stale-update conflicts preserve the editor and require fetching/reviewing the newer plan.
- Server validation caps 100 lines, 100 receipt links per line, 200KB document, quantities 1–999,999,999, references 1–200 characters, settings 0–730 whole days, windows 7/30/90, valid ordered ETA dates or both blank. No quote/cost fields are used in forecast storage.
- No writes to `product_inventory`, `product_shipments`, `orders`, costs, customers or messages. Linking a receipt only records its identity in the planning document. Existing receipt changes are revalidated during saves and flagged by forecast reconciliation when read.

The full approved-shipment candidate RPC payload is in `proposed-shared-save.json` (stable request and line UUIDs), alongside the richer quote/source record in `proposed-incoming.json`. It sets 30-day window, blank lead/safety (no invented supplier guarantee), 10,000 product `1`, 5,000 `driveshaft-cable-xl`, December 1–16 estimates, and empty receipt links. It assumes initial shared revision 0; **fetch the live revision and review existing plans before any approved initial save**. If a plan exists, merge by explicit review rather than replacing it with the candidate. No candidate save has been attempted.

Publication requires approval for: the migration above, code release, and (separately identifiable within the same approval) the exact proposed initial shipment save. No migration, RPC creation, initial save, push, merge or deploy has occurred.

### Persistence validation

- All **195 unit tests pass**, including unavailable-backend, permission-error and uncertain-save handling.
- Isolated PGlite database test executes the actual migration and RPCs with admin, inactive, non-admin and anon roles. Tests deny direct table access, reject invalid/duplicate records, preserve revision on failed saves, exercise exact retries and stale conflicts, verify partial links and confirm stock/cost values unchanged. This is local PostgreSQL-compatible validation, not an integration test against production Supabase/PostgREST or a multi-connection concurrency stress test.
- `tests/browser/inventoryShared.mjs` passes in separate desktop/mobile browser contexts sharing a local fake server: cross-device retrieval, lost-response retry, stale-write preservation, recovery backup, absent migration, denied admin, no overflow or uncaught JS errors. External network requests are blocked.
- Original planning and reporting browser suites rerun; build and 31-route checks repeated.
- Shared screenshots: `/tmp/inventory-shared-1440.png`, `/tmp/inventory-shared-390.png`.

Additional isolated test commands:

```sh
PGLITE_MODULE=/tmp/inventory-browser-qa/node_modules/@electric-sql/pglite/dist/index.js node tests/database/inventoryPlanning.mjs
REPORT_PLAYWRIGHT_MODULE=/tmp/inventory-browser-qa/node_modules/playwright/index.mjs REPORT_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tests/browser/inventoryShared.mjs
```

### Read-only runway evidence, November 1, 2026

Window: October 2 00:00 UTC inclusive through November 1 00:00 UTC exclusive (30 completed UTC days). Current stock is the current read, not historical start stock. Paid orders with confirmed/shipped/delivered status; exact product IDs. Read-only quality check found no malformed eligible orders or item quantities/product IDs in this window.

| Product | Current stock | Observed units | Eligible orders | Units/day | Stock-only runway |
|---|---:|---:|---:|---:|---:|
| Regular (`1`) | 10,120 | 5,880 | 54 | 196.00 | 51.6 days |
| XL (`driveshaft-cable-xl`) | 1,700 | 1,100 | 16 | 36.67 | 46.4 days |
| Cable + (`2`, distinct from XL) | 0 | 0 | 0 | 0 | Unknown; out of stock |
| Caging bolt 10-pack (`3`) | 85 packs | 10 packs | 6 | 0.33 packs | 255.0 days |
| Cutters | 66 | 14 | 9 | 0.47 | 141.4 days |

At unchanged observed rates, the 45-day latest owner estimate leaves only about 1.4 days of XL runway and 6.6 days of regular runway. These are not guarantees: sales may change, stockouts suppress observed sales, creation dates approximate payment dates, refund and test history cannot be fully reconciled from existing schema, and the incoming ETA is unconfirmed. No supplier lead-time/safety policy has been assumed or saved.

Locked dependency install reported 19 existing dependency advisories (1 low, 4 moderate, 13 high, 1 critical); dependency versions were not changed.
