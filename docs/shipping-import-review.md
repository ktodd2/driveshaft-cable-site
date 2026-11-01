# Shipping import review — prepared, not deployed

Based on main `cf8627926314517a66eb982374568d551c4438b4` in an isolated checkout/branch. No production rows, customer emails, shipping services, or homepage/quote options changed.

## Operator workflow

Open **Bulk shipping import**, choose CSV/XLSX, and preview. Every source row is shown, including excluded refunds/voids, invalid amounts and duplicates. Suggested matches never select an order automatically; repeated customer names remain explicit choices. Search all loaded orders to resolve an unknown recipient.

Select the intended order for each usable row. The order review combines all selected source amounts, shows the old cost (including “Not recorded” versus `$0.00`), and requires confirmation of the complete replacement total. Tracking defaults to keeping the existing value. Selecting source tracking and checking the confirmation explicitly authorizes replacement. Saving changes only actual cost, tracking, and updated time. The existing Orders-page tracking email/retry flow is unchanged; imports never invoke it or change order status.

A failed group stops the remaining sequence. Retrying the same frozen review sends stable source keys; the server returns an existing receipt after a lost response instead of writing twice. A stale cost/tracking conflict requires a fresh preview. Cancel clears remaining choices and does not undo already saved groups. Before any request, choices and confirmation can be edited; after an attempt, re-preview to change the selection.

Use **Load recent saved imports** to inspect the latest 20 receipts, old/new cost and tracking, source file/row and label identity. Unfinished exceptions are session-only and can be downloaded as JSON; leaving/reloading clears them. No persistent exceptions count was added to Needs attention.

## Migration and release gate

`supabase/migrations/20261101010000_shipping_import_review.sql` is **prepared only**. Obtain approval before applying it to production, deploying the UI, publishing commits, or importing real rows.

The transaction creates two tables (`shipping_import_receipts`, `shipping_import_sources`) and the `apply_shipping_import` RPC. It uses the existing `admin_users(id, is_active)` authority, restricts receipt reads to active admins, denies direct authenticated writes, and checks admin authority inside a fixed-search-path security-definer function. It locks import saves and the target order, checks expected before-values, atomically writes audit/identity records and the order, and grants authenticated RPC execution. It sends no email. The order ID is stored as text to accommodate the existing order key without changing it.

After approval: confirm the target schema has `orders.id`, `actual_shipping_cost_cents integer`, `tracking_number text`, `updated_at`, and the existing admin membership columns; back up schema; apply this one migration in a transaction before deploying the frontend. Verify read/RPC privileges using an admin test account and a nonadmin account in staging. Deploy only after that check. Roll back the frontend independently; retain populated audit tables for history. Do not drop source receipts after live imports, because that removes replay protection.

## Deliberate limits

- Identity uses tracking, then a transaction/label/shipment ID, otherwise a SHA-256 fingerprint of the normalized source row. Exact repeats and reordered columns are stable; files with no stable identifier cannot be reliably reconciled across modified exports or a different export format. Identical anonymous rows are conservatively excluded. Historical imports predating the receipt table have no source history; operators must inspect the displayed existing total and tracking.
- Complete multi-label sets in one review are summed once. A file mixing already-imported and new labels is rejected, rather than risking a partial/recounted total. Reconcile additions, refunds or voids to previously saved shipments through the existing order workflow. No automatic refund arithmetic is attempted.
- Refund/void entries and a corresponding identity in the same file are blocked; anonymous ledger reversals also block labels with the same recipient. Refunds from other exports are not detectable without a shared source identifier.
- Orders have one tracking field. The operator chooses one number; all selected labels remain in the receipt. Ledger batch totals are treated as aggregates and never invent per-label tracking.
- Limits: 10 MB / 10,000 file rows; at most 1,000 labels per order save. Legacy `.xls` must be converted to `.xlsx`. Numeric XLSX tracking is rejected to avoid truncated digits; tracking stored as text preserves leading zeros and long identifiers.
- Unresolved drafts are not persisted server-side. Downloaded reviews are records, not re-importable drafts. A later persistent exceptions queue would need a separate approved design/migration.

## Verification

- `npm test`: 169 passing tests (158 existing + 11 importer tests).
- `npm run build`: pass; existing large-bundle warning, offline sitemap skips blog fetch without credentials.
- `npm run routes:check`: pass, 31 declared routes.
- `tests/integration/shippingImport.postgres.mjs`: real in-memory PostgreSQL through PGlite; applies the actual migration and verifies replay, reordered labels, cross-order duplicates, zero/null, stale conflicts, transactional rollback/retry, active-admin enforcement and receipt RLS.
- `tests/integration/shippingImport.browser.mjs`: isolated headless Chrome with all backend responses mocked and external requests blocked. Desktop/mobile, explicit ambiguous/manual matching, combined labels, tracking preserve/replace, lost response, partial retry, cancel/back, history, malformed CSV/XLSX and valid XLSX with numeric zero and long text tracking. No real writes.

Reproduce integration checks with temporary test dependencies (no project dependency changes required):

```sh
npm install --prefix /tmp/shipping-import-test-tools @electric-sql/pglite playwright
PGLITE_MODULE=/tmp/shipping-import-test-tools/node_modules/@electric-sql/pglite/dist/index.js node tests/integration/shippingImport.postgres.mjs
# In another terminal; uses fake backend and Stripe settings:
VITE_SUPABASE_URL=http://127.0.0.1:9999 VITE_SUPABASE_PUBLISHABLE_KEY=fixture-key VITE_STRIPE_PUBLISHABLE_KEY=pk_test_fixture npm run dev -- --host 127.0.0.1 --port 4178
PLAYWRIGHT_MODULE=/tmp/shipping-import-test-tools/node_modules/playwright/index.mjs node tests/integration/shippingImport.browser.mjs
```

Set `CHROME_EXECUTABLE` for a Chrome installation outside the default macOS path. Browser screenshots are generated under `qa/shipping-import/` and should remain review artifacts rather than app assets.

## Pre-publication security review

The second review added both client and server validation for imported tracking text (letters/digits/spaces/hyphens, 100 characters maximum). A replacement must equal one of the selected source tracking values. This prevents imported formulas or HTML from reaching later tracking-email rendering. Existing tracking can be preserved unchanged; carrier is explicitly shown as unchanged and can be edited on Orders. Monetary formulas are rejected by strict parsing. Names and other source values are React text nodes, never innerHTML; reviews download as JSON, never executable spreadsheet formulas. XLSX is read as data; formulas/macros are not executed by this importer.

Authorization: `authenticated` can execute the RPC, but it immediately requires non-null `auth.uid()` with an active `public.admin_users` row. The migration revokes RPC execution from PUBLIC and anon. Tables revoke all privileges from PUBLIC/anon/authenticated and grant only SELECT to authenticated, constrained by active-admin SELECT policies. There are no authenticated INSERT/UPDATE/DELETE policies or table grants. Privileged database owners/service operators retain their normal powers; no new service-role bypass is introduced. The existing orders table policies are unchanged.

Migration scope: two tables, the receipt identity sequence/primary key, a source primary key and receipt foreign key, two SELECT RLS policies, and one security-definer RPC with fixed `pg_catalog, public` search path. It installs no trigger, job, extension, email action, or background worker. Applying the migration itself inserts, updates, or deletes **zero existing order rows**; only later explicit RPC calls update cost/tracking/updated_at. No backfill.

Concurrency: an advisory transaction lock serializes this import endpoint, then SELECT FOR UPDATE locks the order. The unique source key is a second duplicate barrier. Expected cost/tracking are compared null-safely while holding the row lock. An exact successful replay returns its receipt only when the current order still matches the saved result; changed values, reuse across orders, partial reused sets, and conflicting totals fail. Receipt/source writes and order update share a transaction, so a failed update rolls them all back. Source keys are supplied by the trusted admin client: this guards normal repeat imports, not deliberate falsification by an administrator who already has order-edit authority.

Audit and drafts serve different purposes: successful receipts are written atomically with the order and must persist for replay protection. Drafts have no successful order transaction and no existing safe draft schema. This change deliberately avoids creating a second workflow database for unconfirmed recipient data. Draft resolution is session-only and downloadable; Needs attention still displays **Unmatched shipping imports — Not saved** with its existing link, never a fabricated count.

Rollback: before any imports, a rollback can drop the RPC, source table, then receipt table (including its owned identity sequence). After imports, disable/revert the frontend and optionally revoke RPC execution, but retain receipts/source keys and already-saved order values. Reverting an applied order requires a separately reviewed correction against its receipt and current order state; never automatically restore old values over subsequent edits. A frontend rollback alone does not undo imported data.
