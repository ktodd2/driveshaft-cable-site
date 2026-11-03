# Separate order-access repair — local build/test only

Branch `feature/order-access-repair`, based on current main `38adb33bbddf38b7625ff3a4df5823ab9aef7d45` (shipping recipient fix, PR 24). This diff does not contain referral rules or automatic email sending. No production schema, permissions, order, payment, email, schedule, credential or deployment was changed. Do not publish this branch or create another PR without separate permission.

## Result

The public browser no longer counts, creates, selects or updates `orders`. It sends validated cart/customer fields to a versioned server checkout endpoint, receives its order ID and payment capability, and uses a minimal server quote for repeat pricing. The server retains immutable order/payment parameters and owns paid-state reconciliation.

Anonymous order access is removed in a separate **staged cutover migration**. Active owners keep their existing order list, manual-sale insertion, status/tracking/shipping-cost edits and reporting through current database-maintained admin membership. Ordinary/inactive authenticated users cannot access orders. No deletion power is added. Shipping import authorization and duplicate-recipient fixes are preserved.

## Files and flow

- `20261103011248_secure_checkout_service.sql`: additive, private `checkout_requests` and `order_payment_receipts` tables, service-only SECURITY INVOKER RPCs, normalized paid-email index and minimal repeat-price lookup. Both tables have RLS and no anon/authenticated privileges. No existing rows are backfilled.
- `20261103011310_orders_least_privilege.sql`: transactional cutover removes the six verified broad anon/authenticated policies and grants, aborts if unexpected public policies remain, then grants authenticated SELECT/INSERT/UPDATE with current active-admin predicates (UPDATE has USING and WITH CHECK). It also removes unnecessary direct trigger-function execution and guards the aggregate stats RPC. No DELETE/TRUNCATE permission remains for browser roles.
- `create-secure-checkout`: new versioned endpoint for backend-first deployment. `create-payment-intent` contains the same safe entry behavior for retiring the old order-ID-only API; it does not accept an arbitrary pre-existing order to mutate. Existing old checkout requests receive a refresh/do-not-repay message rather than an order capability.
- `_shared/secureCheckout.js`: normalizes email without dot/plus merging, combines duplicate products, validates bounded input/US shipping, binds a random request UUID plus 256-bit capability hash to an immutable request fingerprint, and recovers the same provider idempotency key after lost responses. The raw retry token is not stored in SQL or Stripe. Unknown unbound provider outcomes older than 23 hours require owner verification; no payment is automatically canceled and there is no per-email checkout limit.
- `_shared/checkoutPricing.ts`: real catalog/tier/sale math, loyalty versus code precedence, pre-loyalty shipping threshold, tax calculation and stock/quantity validation. Returns no customer rows or order counts. Retains the original explicit tax failure behavior: quote failures surface; payment preparation uses the site's prior fail-open tax policy. This repair does not determine tax obligations or change tax rates.
- `quote-checkout`: public response is only totals, a repeat-price flag, discount source and a tax-quoted flag. The email-only pricing rule still allows inferring repeat pricing from an entered email; no login/OTP requirement was introduced. Rate limits should be checked at the deployed gateway.
- `stripe-webhook` and `verify-purchase`: share authoritative server reconciliation. The webhook verifies the actual raw-body signature asynchronously and retrieves current expanded Stripe state. The confirmation endpoint first verifies the exact Stripe client secret and order binding, then uses the server RPC. Amount, currency, email, original order, request/intent binding and paid charge are checked. A delayed failure cannot undo a paid receipt. No customer name, address, phone, email or secret is returned by confirmation.
- Database row locking and unique receipts serialize paid/stock/discount effects. Stock remains in the existing trigger, which works for both verified retail payment and active-owner manual-sale update. Stripe Tax finalization has a separate durable claim and stable provider key; uncertain provider/storage outcomes remain in processing/review for verification rather than blindly creating another tax transaction.
- `checkoutPayment.js`: private draft ID/token persist in tab session storage before the request. Reload retries recover that identity; completed redirected payments clear the draft from session and memory. A later identical purchase gets a fresh request ID. Customer form text is represented only by its SHA-256 fingerprint in this retry record.

## Legacy boundary and review requirements

Existing open return tabs retain their Stripe client-secret capability. A matching already-fulfilled legacy order can confirm without historical stock/discount/tax backfill. New legacy fulfillment additionally requires immutable `ga4_purchase` financial components and unit prices to match the old row, as well as metadata item IDs/quantities, receipt email, total and intent binding. Missing/oversized old financial snapshots or mismatches require owner review rather than guessed fulfillment.

Previously public order tax columns are **not** trusted. The calculation reference comes from authoritative Stripe metadata, and legacy tax finalization is held for provider verification; it is never silently treated as accepted or recreated from a possibly altered old row.

Pending legacy delivery addresses have no private pre-cutover snapshot. Valid Stripe monetary/item evidence cannot prove those addresses were never changed while old anon UPDATE access existed. The owner must verify delivery details for pending pre-cutover orders before shipping. This repair closes future public access; it does not authenticate or silently repair every historical value. No historical private records were extracted during implementation.

An unknown/review tax receipt requires operator verification in the provider and the private receipt ledger. Do not automatically clear processing/review flags or retry after the provider idempotency window. The existing manual-order `finalize-tax-transaction` path stays unchanged and active-admin protected.

## Validation

- Full unit suite, including new actual pricing/helper/endpoint/confirmation tests.
- `tests/database/orderAccess.mjs`: actual isolated Postgres/PGlite migrations, private RPC grants, anon/ordinary/inactive denial, active-owner manual/status/report/shipping behavior, concurrent request/payment/tax claims, stock/discount exactly once, old failed notification safety, legacy financial tampering rejection and untrusted legacy tax hold.
- Existing `tests/integration/shippingImport.postgres.mjs`: full original shipping receipt, duplicate, stale conflict, rollback and active-admin checks.
- `tests/browser/orderAccessCheckout.mjs`: isolated headless Chrome at localhost port 3018, temporary profile, all external calls blocked. Actual desktop/mobile checkout uses server quote/loyalty, recovers a lost response with the same private ID/token, survives a full Stripe-return navigation and clears the finished draft. The browser makes **zero** `orders` table requests even when that route is explicitly denied. No page errors or horizontal overflow.
- Deno checks cover `create-secure-checkout`, `create-payment-intent`, `quote-checkout`, `stripe-webhook` and `verify-purchase`.
- Fixture Vite build and prerender/schema/sitemap verification; no fixture artifact may be deployed.
- An independent read-only security review found and rechecked fixes for legacy tax trust, legacy monetary breakdown verification and redirected draft reuse. No remaining capability/authorization bypass was identified. The historical legacy-address uncertainty above remains explicit.

[Desktop checkout](screenshots/checkout-1440.png) · [Mobile checkout](screenshots/checkout-390.png) · [Desktop confirmation](screenshots/confirmation-1440.png) · [Mobile confirmation](screenshots/confirmation-390.png)

Local optional validation tools are in `/tmp/referral-tools`. This worktree temporarily uses the sibling project's ignored `node_modules` for tests, with its own Vite cache `/tmp/order-access-vite-cache`. No dependencies or lockfiles were upgraded.

## Safe deployment sequence — approval required

1. Re-read current production policy/grant/function metadata without extracting customer rows; confirm no concurrent changes and preserve PR 24. Review this diff and the old pending-order/provider-review inventory with the owner. Obtain explicit permission before any deployment/migration/access change.
2. With staging authorization, apply only the additive service migration in an isolated environment. Deploy `quote-checkout`, the new versioned `create-secure-checkout`, shared reconciliation dependencies and capability-protected confirmation. Exercise real gateway authentication, RLS/grants/advisors, multi-connection concurrency, provider/webhook delivery, new/repeat/code/shipping/tax totals, manual-owner workflows and denied non-admin access using synthetic data and intercepted email. The isolated engine serializes calls and is not a hosted concurrency stress test.
3. For production after approval, deploy the additive schema and versioned safe endpoints first. Publish the new frontend so fresh buyers use `create-secure-checkout`; the old endpoint can remain unchanged briefly during this coordinated transition. Then deploy the safe `create-payment-intent` retirement behavior and server-owned webhook, and apply the least-privilege cutover migration. Old pre-payment tabs must refresh; already-paid returns can still verify by their private payment capability. Never reopen order access or charge again to recover a stale client.
4. Coordinate the frontend/backend/policy transition in a bounded maintenance/release window. Test an existing paid return, a fresh checkout and an active-owner manual/shipping update immediately after cutover. Keep referral/email activation off until separate composition and validation are complete.
5. Any new remote PR publication needs explicit approval. This local build/test authorization is not production or publication authorization.

## Rollback

Keep the private service schema and payment receipts so retries cannot create duplicate effects. Keep the safe versioned checkout/confirmation path available; roll forward to a known-good compatible build or briefly stop new checkout preparation if necessary. **Do not restore permissive anonymous order policies** as a routine rollback. Reverting only the frontend to direct table access would break checkout under the repaired policies, so frontend/server rollback must be coordinated. Existing captured payments must continue to reconcile safely; do not cancel or charge again automatically. Manually issued orders or provider tax transactions are not undone by a code rollback.

## Referral integration — not yet tested as a combined system

This branch is intentionally based on main and separate from PR #25. It necessarily overlaps `CheckoutPage.jsx`, `create-payment-intent`, `stripe-webhook` and shared purchase/confirmation behavior. Do not blindly cherry-pick both versions and claim combined coverage.

An explicit composed implementation must:

1. Keep the access repair's normalized intake, private retry capability, service-created order and immutable intent parameters as the single checkout source of truth.
2. After `prepare_secure_checkout` returns the new order UUID and before Stripe creation, invoke PR #25's **named** referral preparation using that order ID, normalized email, frozen `normalized.customer.name`, buyer-entered code, discounted merchandise and separate shipping/tax. Include the referral code in the immutable request fingerprint and preserve it on retries. Never fall back to browser order insert/read/update.
3. Put all required secure/referral metadata in one immutable Stripe parameter snapshot so both integrations recover the identical provider key/intent. Avoid separate competing PaymentIntent creation paths or mismatched idempotency keys.
4. Share authenticated payment observations: securely reconcile order/stock/discount first, then referral ordering/refunds with retryable failures and no duplicate effects. Preserve first-paid attribution under reverse webhook delivery, seven-day time, permanent email links and fully refunded sequence position.
5. Re-run both branches' combined SQL/endpoint/browser/payment/refund/concurrency suites plus the newly authorized per-customer referral statement details/disclosure tests before release. The normalized buyer name is available here for the named hook; this separate diff does not add referral PII to emails or logs.
