# Historical settings-only checkpoint — superseded

The choices below were subsequently confirmed and implemented locally. Read [the current v2 review](per-code-policy-v2-review.md) for current scope, validation and launch gates. This document preserves the earlier checkpoint only.

Owner confirmed November 3, 2026: default first-time buyer discount 5%; default commission 10% order 1, 5% order 2, 2% orders 3–10, 1% orders 11–20, zero after order 20. Buyer sequences restart per email. Both discount and schedule adjustable per code. Merchandise after all applied discounts remains the only commission base; no tax or shipping commissions.

## Implemented locally

- `referralPolicy.js` validates integer basis-point discounts, bounded increasing tier end orders, zero/custom rates, and the new default including orders 20/21.
- Additive migration `20261103143717_referral_code_policy.sql` stores per-code settings and append-only service-role policy versions. It validates all inputs in Postgres, checks active admin, serializes edits on the partner row, rejects stale revisions and records before/after audit data. Browser roles receive no access. This migration does **not** change any existing earning, reconciliation function, feature flag, schedule or checkout price.
- Admin settings UI edits discount and tier end orders/rates, previews terms before saving, and includes an explicit integration-review notice. Server endpoint uses the authenticated actor, never a client-supplied actor ID.
- Existing origin correction remains a separate unpublished local change in this worktree.

## Decisions requested, not assumed

1. Coupon precedence: use the better single discount (proposed) versus stacking. Existing coupon/loyalty precedence stays unchanged until resolved.
2. First-order meaning under overlapping checkouts: a one-use reservation prevents two discounts but cannot guarantee the reserved checkout pays first. Another previously prepared, undiscounted intent can succeed before it. Reservation expiry alone is unsafe because a still-payable Stripe intent can succeed later. Strict first-paid eligibility would require coordinating competing payment confirmations/captures or additional checkout restrictions; neither is silently authorized. No automatic intent cancellation or all-buyer restriction has been introduced.
3. Policy edits for existing linked customers: retain their original schedule (proposed) versus apply edits to future orders. All previously earned amounts/rates and original refund calculations must remain immutable either way.

## Remaining implementation before new terms can be called complete

- Atomic discount eligibility/reservation and idempotent recovery based on the chosen concurrency policy; authoritative quote, immutable checkout preparation and tax totals must agree. No arbitrary expiration may release a live payable intent.
- Replace the **effective** `referral_reconcile` installed by `20261103020100_referral_ambiguous_history_hold.sql` in a subsequent migration. Preserve unresolved history holds, verified payment timing, refund positions, and permanent attribution. Change the existing JS `referralRate` mirror at the same integration point. The old runtime mirror/reconciler still use the old schedule and must not be represented as the new implementation.
- Expand earning rate constraints for custom/zero values and snapshot the chosen policy per earning/checkout, without re-tiering old rows. New config history alone is not this transaction snapshot.
- Bind per-code terms to private signup preview; update old signup/admin/checkout/statement copy that still says no buyer discount or 1% forever. Buyer disclosure must continue to explain the referrer receives name, eligible product spend and commission.
- Validate discounts, refunds before/after vesting/issuance, first/no-code/existing/self code, independently edited codes, true overlapping payment/edit sessions and reverse webhook order; rerun composed checkout and hosted signed Test-mode provider paths under the new rules.

## Validation completed at this checkpoint

- `npm test`: 340 passed (includes 3 new policy unit tests; original tests remain regression evidence, not proof the new checkout behavior exists).
- Local PGlite `tests/database/referralPolicy.mjs`: passed input validation, per-code isolation, active/inactive/admin/browser authorization, stale-save rejection, idempotence, append-only role permissions and audit/version counts. Its Promise race is serialized by PGlite; **not** a genuine multi-session overlap test.
- Deno type check for changed `referral-admin`: passed.
- Headless isolated desktop 1440px and mobile 390px fixture UI: passed editing, review without mutation, saved revision/discount/tier payload, no horizontal overflow, existing approval/invitation/signup regressions and zero external network. Screenshots `screenshots/code-policy-1440.png` and `screenshots/code-policy-390.png`.

No commit, push, hosted migration, deploy, email, order, payment, payout, or production access change occurred for this new requirement. Existing draft PR heads remain unchanged.

## Staging deadline and other blocked work

Replacement synthetic Supabase project `dmpvmztdkfdkilygxiaj` remains active. Conservative billing start November 3 05:42:19.138882 UTC; hard 24-hour deadline **November 4 05:42:19.138882 UTC**; approved total budget $1. Separate deletion approval is still required. Its current code uses the old rules: do not run old-assumption scenarios as validation of the new requirement.

The previous protected staging order-policy cutover was denied by automatic approval review because secure backend/frontend deployment and tests had not yet been established. It has not been retried. New terms make the missing integrated tests material; do not bypass or partially reproduce the denied cutover.

Mac audio request: System Settings showed aggregate `Main Output`, normal mute disabled. Audio MIDI Setup inspection showed the Mac Studio speaker mute off. These were reads/selection only; no mute change or success readback exists. Native tool calls were heavily delayed. The staging JavaScript confirmation has not yet been inspected or cleared using the native UI; never accept its unknown content blindly.
