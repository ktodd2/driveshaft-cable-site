# Per-code referrals v2 — local review

November 3, 2026. No new commit, push, hosted migration or deployment. Draft PR 27 remains at `b9d50142aa98f2de832354d758471aa752790967`; these changes are unpublished in this worktree. Existing staging still runs the old terms and does not certify v2.

## Confirmed behavior implemented

- First-time buyer product discount defaults to 5%, adjustable per code with two decimal places in percent.
- Per-buyer default commissions: 10% order 1, 5% order 2, 2% orders 3–10, 1% orders 11–20, then zero. Owner edits each code’s rates and tier ending orders. Attribution/count remain permanent after the commission schedule ends.
- Add referral percentage to the existing applicable discount (larger of coupon/returning-customer discounts), on the same merchandise subtotal. 5% coupon + 5% referral = 10%. Cap discounts at merchandise value. Existing volume/sale pricing and pre-discount shipping thresholds remain. Tax line allocation uses exact largest remainders; commission never includes tax/shipping.
- Strict first-paid protection: one payable first-order checkout per normalized email, atomically enforced. Retries reuse the capability/provider key. No automatic expiry or cancellation. Explicit buyer cancellation or active-owner reviewed recovery releases only provider-confirmed unpaid cancellations. Processing payments and old unknown provider references remain held.
- Durable checkout-ID cancellation tombstones suppress delayed preparations, even before a checkout row exists. Prepare locks email→ID. Cancellation requests hold ID only, then release it before final cancellation obtains email/row locks. Both interleavings pass real PostgreSQL tests.
- Private resume restores frozen customer/product/financial details after reload without repricing. Known processing/paid status remains recoverable during pending cancellation. Active-owner exact-email search reaches lost-session holds beyond the first 200 records without exposing capabilities/client secrets.
- Edited schedules affect newly prepared future orders for existing and new linked buyers. Prepared checkouts keep their terms; earned amounts/rates never change. Refunds use original rates. Pre-migration prepared rows, including uncoded rows later inheriting attribution, preserve legacy terms.
- Private signup previews the actual code policy and requires the same revision at acceptance. Stale acceptance does not consume an invite. Checkout/statement disclosures reflect per-code terms and preserve authorized own-referrer name/spend/commission detail.
- A $0 final total explicitly requires owner assistance and creates no payment. No unreviewed free-order fulfillment or artificial paid order is added.

## Deliverables and validation

`20261103143717_referral_code_policy.sql` adds validated settings, version history, active-admin compare-and-swap edits and audit. `20261103143732_referral_policy_checkout_runtime.sql` replaces the effective ambiguity-aware reconciler, adds transaction policy snapshots/custom and zero rates, coordination, tombstones, signup revision checks and owner lookup. Neither activates flags/schedules or performs the protected order-access cutover.

Server pricing/quote and both creation routes, new capability-protected cancel/resume endpoints, checkout recovery, admin settings/search, signup and statements are updated. The earlier guarded invitation-origin correction remains preserved and unpublished.

Validation completed:

- **348 unit tests pass**, including policy defaults/custom values/20–21, exact discount allocation and receiver-owned verification.
- **16 composed integrations pass** against actual pricing/effective SQL in ephemeral PGlite: stacking, first-order coordination, cancellation/processing/uncertain states, delayed tombstones, private resume, future edits, tier cap, refunds after issuance, legacy migration retention, nullable legacy evidence, signup revision and lookup/security beyond 200 holds. Provider transport is simulated.
- Separate policy SQL validation passes malformed input, per-code isolation, active/inactive/browser authorization, stale saves, idempotence, immutable version permissions and audit.
- **Real PostgreSQL 17.6 independent sessions pass**, with `pg_blocking_pids`/timestamps in [concurrency evidence](concurrency-v2-local.json): competing first checkout, reverse/overlapping payment observations, simultaneous edits, prepare/edit serialization and both prepare/cancel orderings. Provider/signature transport remains simulated. The temporary DB uses a private Unix socket, TCP disabled, and is stopped/removed after testing.
- Isolated desktop 1440px/mobile 390px admin/signup and storefront fixtures pass quoted pricing, lost-response retry, reload/resume and confirmation navigation. All external requests blocked; no user browser, real payments or emails used. Screenshots under `screenshots/` and `../integration/screenshots/`.
- Seven Edge entrypoints type-check; diff whitespace checks pass.
- Independent review collected: every concrete cancellation, history and recovery defect it raised is fixed and independently reproduced. Its last complete run covered 342 units/15 integrations; the additional 202-hold integration passed in the primary run.

## Remaining launch gates

1. **The owner selected buyer email verification.** It is now implemented and tested locally: a request never gives its caller ownership, opening the link alone verifies nothing, and an explicit receiver confirmation creates a one-hour browser proof. All new first-order reservations require possession, including uncoded checkouts, to close the alternative reservation path. Frozen checkout capabilities retain recovery. See [verification review](buyer-email-verification-review.md). Hosted verification and provider configuration remain pending; no real message or new credential was created.
2. Fresh guarded hosted API/browser/Stripe Test-mode payments, signed webhook delivery, cancel/resume, refunds and positive-tax validation must cover v2. Old provider results are historical evidence only. No tax registration/settings changes occurred.
3. The protected staging order-policy cutover is **denied, known not executed, and not retried**. Automatic approval review required secure frontend/backend deployment and tests first. Do not bypass or partially reproduce it. Production permissions, migrations and release remain separately gated.
4. Exact recipient/content approval is required before real owner-only test emails. Invitations, monthly scheduling, production activation and payouts remain off.
5. Replacement synthetic project `dmpvmztdkfdkilygxiaj` was last known active. This pass made no hosted mutations. Conservative billing start November 3 05:42:19.138882 UTC; hard deadline **November 4 05:42:19.138882 UTC**, total approved $1. Separate action-time deletion approval remains required well before the deadline. No budget/resource extension is implied.

After remaining validation, review/publish the exact diff with appropriate approval. Deploy additive migrations before coordinated v2 handlers/frontend with offers/emails off; verify both create routes and private-capability gateways. Old unknown payable history cannot be cleared using editable cancelled status or nullable payment fields.

Rollback disables new offers/sends while preserving prepared payments, frozen terms, reconciliation, refunds, liabilities and owner recovery. Never drop the ledger, re-tier past orders, restore broad anonymous order policies or expire a still-payable checkout. No rollback automatically cancels payments, sends communications or issues money.
