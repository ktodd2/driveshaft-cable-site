# Production order access and automatic monthly email follow-up

Read-only investigation on 2026-11-03 UTC against Supabase project `twrihhyfvomqiqbxkitc`. No production customer/order rows, financial aggregates, anonymous bulk API results, credentials, or access logs were retrieved. Only catalog metadata and one aggregate-function definition were inspected. No database writes, access changes, deployments, sends or scheduler changes occurred. Remote publication remains denied/pending explicit human approval; no retry was made.

## What is verified in production

`public.orders` has RLS enabled. Its actual production policies are permissive:

| Role | Operation | Policy | Predicate |
|---|---|---|---|
| anon | SELECT | Allow reading own orders | `USING (true)` |
| anon | INSERT | Allow anonymous inserts | `WITH CHECK (true)` |
| anon | UPDATE | Allow anonymous payment status updates | `USING (true) WITH CHECK (true)` |
| authenticated | SELECT | Admin can view all orders | `USING (true)` |
| authenticated | INSERT | Admin can insert orders | `WITH CHECK (true)` |
| authenticated | UPDATE | Admin can update orders | `USING (true)`; no narrower `WITH CHECK` |
| service_role | ALL | Service role full access | true |

Both `anon` and `authenticated` have effective public-schema USAGE and table-wide SELECT/INSERT/UPDATE grants. They also have DELETE/TRUNCATE/REFERENCES/TRIGGER grants. There is **no** anon/authenticated/PUBLIC DELETE or ALL row policy. Therefore DELETE grants do not establish allowed row deletion under RLS. TRUNCATE is not covered by RLS, but ordinary PostgREST table endpoints do not expose SQL TRUNCATE; this investigation did not demonstrate a public SQL/RPC route to execute it. Remove the unnecessary grants as defense in depth without claiming an anonymous truncate exploit was reproduced.

The SELECT/INSERT/UPDATE policy names are misleading: no ownership, email matching, active-admin check or column restriction exists in those predicates. The configured database permissions permit every row/all columns for those operations. The site source uses browser Supabase calls directly against this table. Public HTTP gateway/Data API exposure was not independently probed: schema settings were not present in the inspected database/role settings, and no anonymous customer query was sent. This is a verified **production authorization configuration issue**, not proof that anyone accessed or changed data.

Affected column categories confirmed from the production catalog: names, emails, company, phone, shipping address, products/quantities, prices/discounts/tax/shipping/total, statuses, tracking numbers, acquisition notes, email-automation markers, Stripe PaymentIntent IDs and tax references. The catalog does not contain card numbers or Stripe API secrets. No values from those columns were read.

Two enabled production triggers amplify the potential integrity impact:

- `orders_decrement_stock_trigger`: BEFORE UPDATE, SECURITY DEFINER, paid/stock-decremented gate, updates product inventory. A permitted forged order update could therefore affect stock and reports/fulfillment that consume the paid flag. No such update was attempted.
- `orders_mark_cart_recovered`: AFTER INSERT or UPDATE OF payment_status. Forged status changes could affect recovery attribution. No mutation was attempted.

Related production metadata:

- `get_email_automation_stats()` is SECURITY DEFINER and executable by anon/authenticated, with no active-admin guard. Its definition returns aggregate email counts, timestamps and recovered-cart revenue, not customer rows. It should also be restricted; the function was not invoked.
- `orders_decrement_stock_on_paid()` has broad EXECUTE privileges, but is a trigger function and cannot simply be invoked as a normal RPC to edit stock. The broad order UPDATE path is the relevant risk.
- `apply_shipping_import(text,integer,text,text,jsonb,text)` denies anon EXECUTE and its current production source contains `auth.uid`, `admin_users`, and `is_active` checks. Preserve this existing shipping fix.

No evidence of exploitation or historical misuse was sought or found in this bounded metadata review. No claim about existing incident scope is made.

## Existing dependencies that a fix must preserve

| Existing flow | Current source behavior | Effect of blindly revoking anon orders access |
|---|---|---|
| Checkout creation | `src/pages/CheckoutPage.jsx` inserts an order and selects its full row | Checkout creation fails before payment preparation |
| Repeat-customer pricing | Same component counts paid orders by supplied email directly | Client may show no loyalty discount while server applies it, causing a total mismatch |
| Immediate payment completion | Same component updates payment/confirmation/intent ID after Stripe success | Browser fallback stops working; server fulfillment must already be reliable |
| Return-page recovery | `src/pages/OrderSuccessPage.jsx` verifies with the server, then directly writes paid state | Fallback write fails after payment; verified page display remains separate |
| Orders/admin/dashboard/reporting | Authenticated browser reads all orders, inserts manual sales, edits statuses/tracking/costs | A blanket authenticated revocation breaks legitimate owner workflows |
| Shipping import | Existing active-admin RPC | Preserve its checked authorization and behavior |
| Public tracking | `track-order` service-side function validates email + ZIP/order reference and returns a limited DTO | Can continue without anonymous table access |
| Marketing/tracking/tax/referral server functions | Service-role database client | Can continue with narrowly retained service access |

The existing admin delete button calls DELETE, but no authenticated DELETE row policy was found. Do not silently add delete permission as part of this repair; either keep it unavailable or handle its desired behavior in a separate owner decision.

## Proposed least-privilege fix — separate, not applied

1. Introduce a server-owned checkout creation/quote path: take validated customer/cart fields and a private idempotency capability, compute catalog pricing/loyalty/discounts/shipping/tax on the server, create the pending order, and return only its ID, totals and payment capability. Never accept client-supplied paid state, trusted totals or arbitrary order-field updates. Bind retries to the original capability and immutable checkout snapshot.
2. Replace the browser's order-count query with that server quote's minimal price result. This still lets a caller infer repeat pricing from an email (the existing email-only pricing rule); it should not return counts, customer records or addresses. Rate limiting is appropriate. Do not introduce an unapproved customer-login/OTP requirement merely to implement this fix.
3. Make the signed webhook and a capability-protected server reconciliation fallback own fulfillment/payment transitions and inventory-trigger updates. A verified PaymentIntent must match the original order, amount, currency and allowed state. Failed DB writes must remain retryable, rather than logging an error and returning success. Remove the two browser paid-state writes only after this path is tested. Do not make referral payment ordering depend on the mutable legacy paid flag.
4. Atomically migrate privileges/policies after the replacement front/backend are ready: revoke all direct `orders` privileges from anon; replace broad authenticated policies with SELECT/INSERT/UPDATE policies requiring a current active `admin_users` row for `auth.uid`; regrant only the authenticated operations needed by existing owner workflows. Include an active-admin predicate in both UPDATE USING and WITH CHECK. Remove all broad permissive policies, since merely adding a narrower permissive policy would leave the original `true` policy effective. Retain service-side access. An alternative is moving all admin writes behind checked server commands; that is a larger UI scope, not required just to remove non-admin access.
5. Revoke unnecessary PUBLIC/anon EXECUTE on the stats RPC and add a current active-admin guard for authenticated callers. Narrow trigger-function execution and unused table DDL/TRUNCATE/DELETE grants without changing trigger behavior or adding new deletion powers.
6. Verify locally and in isolated staging: anon cannot read/write any order; ordinary authenticated/inactive users cannot read/write; active owner can perform existing manual sale/status/tracking/report flows; verified retail payment/replay/failed-after-success fulfills exactly once; new and repeat prices match; public tracking remains limited; shipping PR 24 stays intact. Test old open checkout/return tabs: an already-paid return may lose its browser fallback, but the server still fulfills it. Never charge a second time to recover a blocked old client.

This is a concrete proposal for separate implementation/release permission. No permission migration or server-checkout replacement was executed in this follow-up.

## Automatic monthly statements: local implementation completed

The user confirmed automatic monthly balance emails and separately confirmed owner approval for payouts. The initial draft’s manual-send-only gap has now been fixed locally within PR #25; production delivery remains off. The approved order-access repair is on a separate local branch and is not folded into the referral diff.

Implemented in the second staged referral migration and shared `referralStatements.js`:

- One frozen recipient/name/code/balance/creation-time snapshot per partner/month, protected by an immutable-snapshot trigger.
- The manual and scheduled sender share the exact existing `referral-send-statement` / statement-ID / `statement-v1` identity and provider key. No duplicate key family was introduced.
- Current-month preparation can run after a missed 1st. Signup and the actual activation timestamp determine the first eligible Chicago month boundary. Previously frozen unsent statements remain queued across rollover; missing historical months are not newly backfilled. Emails state the actual balance-preparation time.
- A durable queue excludes accepted, pending, uncertain and rejected attempts **before** its batch limit. A two-minute lease controls concurrent automatic runs; the email-attempt claim protects against a simultaneous manual send or a process crash. Unknown provider outcomes are held for review, including beyond provider-key retention.
- Each invocation is limited to 50 deliveries and a 40-second budget with spacing between calls. A **recurring hourly scheduler is required**, since `more:true` is drained by later invocations rather than internal dispatch. Monthly mail is still once per eligible partner/month.
- Zero, positive and negative balances are stated without moving money. Unaccepted invitations are excluded. Pausing new referral enrollment does not stop statements for permanent links.
- Environment and database send/automatic gates default off; `statements_started_at` defaults null. The worker cannot be enabled by a request body. It is cron/backend/active-admin authorized, with no payout or redemption-approval path.
- Persistent cumulative review counts keep held statements visible in admin and execution history even on subsequent empty runs.

Verification: 20 focused worker/endpoint tests and the isolated Postgres monthly suite pass, including manual/automatic races, worker concurrency, batch continuation, kill switches, ledger/provider outages, Chicago/DST boundaries, catch-up, rollover, immutable content, lease recovery, minimized delivery data and no payout path. An independent read-only review found one observability issue; it was fixed and covered by regressions. Hosted multi-connection, gateway/cron, rate-limit and real-provider configuration checks remain staging gates.

Required release configuration remains unperformed:

1. Approve deployment/application of the four staged referral migrations and updated worker/shared sender, then test in an isolated environment with provider traffic intercepted.
2. Set the actual approved activation timestamp, server/database email gates and both automatic-statement gates only during explicitly approved rollout. Verify the reviewed sender, reply-to and fixed enrolled recipients.
3. Create exactly one new hourly authenticated check job for `referral-monthly`. It prepares on the first due Chicago cycle and resumes batches/catch-up thereafter. Do not run global cron setup or alter paused job 26 or other schedules.
4. Keep individual check/product redemption approval and manual issuance required. Automatic statement emails do not pay rewards.

No scheduler, real provider call, credential or production setting was created or changed by this local implementation.

Subsequent user-authorized additions are also staged: custom or generated unique codes, and named per-customer eligible-spend/commission details. Statements separate the previous Chicago calendar month from lifetime totals, show mixed rates and pending/vested/held amounts, and mark unallocated refunds provisional. Buyer contact/address/payment/tax/shipping details remain excluded. The code-entry disclosure explicitly covers this and future same-email purchases. Code editing is not exposed; collisions never overwrite existing partners. See the fictional statement preview and code-setup screenshots in this directory.

## Recommended sequence and exact pending gates

1. Finish and review the approved separate local order-access repair. Automatic monthly statement implementation is now locally complete and independently reviewed in the referral draft; production gates remain off.
2. Publication-only permission was subsequently received and draft PR #25 was opened. Keep it unmerged and disabled. A second remote access-repair PR requires separate publication permission.
3. With separate staging authorization, deploy to an isolated environment and run full hosted authorization/concurrency/payment/email tests with intercepted email and no production users/orders. Apply security advisors there. A new billable environment needs its own cost approval.
4. Obtain explicit production checkout/access migration and Edge/static deployment approval. Coordinate the server/frontend/policy transition so checkout remains functional and private. Keep referral/email flags off during this transition; preserve shipping, tax, existing pricing and schedules.
5. Review and approve referral activation and an owner-selected invitation. Apply only the reviewed referral migration; no historical commission backfill. Test the permanent-link and refund path with approved release evidence before broader invitations.
6. Separately approve the monthly scheduler and automatic statement sends. Keep every payout/product issuance manually owner-approved. Never silently turn off future earnings for existing permanent links when rolling back enrollment; keep tracking/reconciliation or an equivalent durable recovery path running.

The metadata investigation did not mutate production or read customer rows. Subsequent explicit permission allowed publishing the disabled referral draft. The automatic-mail implementation is local/staged; production operations remain unapproved and unperformed.
