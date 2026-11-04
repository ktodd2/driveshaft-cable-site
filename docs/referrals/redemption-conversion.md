# Check and product redemption terms

Current owner instruction: checks pay 50 cents per reward dollar; product redemptions use the full reward value. This conversion is global, separate from each code's editable buyer discount and commission schedule.

- $100 available rewards supports a $50 check OR $100 total product redemption (merchandise at retail prices, shipping and any separately determined tax).
- The owner enters the actual check amount. A $50 check creates a request for 10,000 reward cents and 5,000 cash cents. Approval reserves 10,000 reward cents; manual issuance consumes those same reward units. The application never transfers money.
- Each cash cent consumes two reward cents. A leftover odd reward penny stays available. A $100.01 balance supports a maximum $50.00 check and retains $0.01 rewards.
- Product requests consume retail merchandise plus shipping and determined tax from rewards at 1:1. Insufficient balances cannot be approved; a negative balance after refund prevents issuance until sufficient future earnings arrive.
- New signup acceptance records the redemption terms version. Old cached signup/check forms must refresh and review the new terms before proceeding.
- Each request freezes conversion version, reward cost and check cash amount. Historical requests and statement snapshots keep their original values; no earned commission or per-code earning rate is rewritten.

## Safe release

The guarded migration aborts if any earned rewards or accepted partner terms exist. This prevents retroactive terms changes without a new owner decision. Production read-only preflight on November 4 found zero partners, accepted partners, earnings and redemptions. Repeat preflight at cutover; the guard and table locks are authoritative.

1. Publish reviewed source. Compare effective `referral_admin` body with the baseline before replacing it.
2. Apply `20261104053945_referral_check_cash_conversion.sql` using the approved migration path. It adds immutable conversion snapshots and service-only RPCs; checkout, commission and order code remains unchanged.
3. Deploy `referral-admin`, `referral-monthly` and `referral-signup` with the new shared helper in each dependency bundle. Preserve flags, secrets and schedules.
4. Deploy the exact reviewed frontend. Cached check/signup forms fail closed until refreshed.
5. Read back version/privileges and deployed artifacts without creating partners, invitations, campaign records, orders or payouts.

Rollback must preserve frozen request and statement conversion fields. Do not drop the columns or restore the old request function: that would reintroduce full-value check creation. If an issue is found, hold manual redemptions and signup while correcting the versioned code; existing earnings and purchases continue. No existing customer record should be rewritten.

## Announcement template

Admin → Email Blast → **Referral Program Introduction** is a reusable preset, not a saved campaign. Selecting it only fills the editor. The copy includes the default 5% buyer discount, 20-order commission schedule and the explicit $100/$50 check example. It must be reviewed if the owner chooses different code terms.

No campaign should be created or scheduled until the owner clarifies the exact audience. Existing marketing source requires separate recipient/suppression and exact-time scheduling review; the normal hourly dispatcher cannot promise 7:30 a.m. Central.

## Validation

360 unit checks; local ephemeral PostgreSQL conversion fixture (legacy values, stale signup/check requests, guard abort, immutability, approval/issuance idempotence, insufficient balances, refunds, product shipping, audit, authorization); desktop/mobile browser fixtures; three Deno handler checks; fixture build/prerender; existing composed checkout/discount/tax/payment/refund and signed webhook fixtures. Local serialized database calls are not new proof of overlapping hosted sessions. No real customer message or provider payment was used.
