# Verified GA4 purchases

## What is reported

The existing GA web stream `G-SDQTZK079P` receives `purchase` only after the
read-only `verify-purchase` function retrieves a successful live Stripe
PaymentIntent and checks its exact client secret and server-owned order binding.
It does not trust `redirect_status`, a cart total, or a client-writable paid flag.
The event uses the order UUID as `transaction_id`, USD, discounted merchandise
`value`, separate shipping/tax, and product IDs, quantities and net unit prices.
No customer names, emails, addresses, phone numbers, free-text item names,
discount codes or Stripe secrets are sent to GA.

`create-payment-intent` adds a compact immutable snapshot of its existing
server-computed prices and totals to Stripe metadata. The verifier checks that
items reconcile to subtotal and that subtotal minus discount plus shipping/tax
equals the succeeded intent's amount and amount received. Discounts are allocated
in cents; a product can have two item rows one cent apart to preserve exact totals.

Stripe return secrets are captured synchronously before analytics or ad scripts
load, removed from the URL, and kept only in this tab's memory/sessionStorage
(with a 24-hour client lookup limit). Successful verification also gates the
existing browser fulfillment fallback. The webhook is unchanged; this feature
neither creates nor confirms a payment. The fallback only updates a not-yet-paid
order so revisiting confirmation cannot reset an already paid/shipped order.
Only a matching checkout cart is cleared, once.

## Duplicate and consent handling

- In-memory and localStorage markers prevent repeated sends on re-render/reload.
- Web Locks coordinate simultaneous tabs where supported. The stable transaction
  ID also enables GA web-stream purchase deduplication.
- A marker means queued to gtag, not receipt acknowledged by Google.
- Explicit `gtag('consent', ..., {analytics_storage: 'denied'})`, GA opt-out and
  Global Privacy Control suppress reporting and analytics marker writes. A later
  consent update/tag load can report while the confirmation page stays open.
- No consent is granted here. The existing site has no built-in consent banner;
  when no consent command exists this preserves the existing tag behavior.

## Limitations

This is browser purchase measurement, not a complete payment ledger. Customers
who never return, close the tab early, block GA or remain offline can be missed.
Cleared/disabled storage and different devices limit client-side deduplication;
GA transaction IDs provide a further guard, not a universal exactly-once promise.
Async payments are checked for one minute on the open page with a Check Again
button; webhook fulfillment remains independent. Manual/offline orders, refunds,
old intents without snapshots, test-mode payments and oversized snapshots (>500
characters) are not reported. No historical backfill is performed.

## Release order — approval required

1. Confirm the intended Supabase project and frontend hosting target.
2. Deploy `verify-purchase` and its shared helper to the same Supabase project,
   using the existing `STRIPE_SECRET_KEY`. Keep the existing anon-JWT gateway
   policy (do not disable JWT verification); the checkout client secret is the
   additional order-specific authorization. No new secrets, grants or schema.
3. Deploy the updated `create-payment-intent` with its existing shared imports
   plus `purchaseAnalytics.js`. Existing price/payment behavior stays unchanged.
4. Verify both functions are present, then publish the frontend. Deploying the
   frontend before the verifier would leave buyers at an unverified page.
5. Run the isolated browser suite in an environment able to launch Chromium.
   Do not create fake live purchases or send fixture events to production GA.
   After approval/publication, inspect the next genuine consenting purchase in
   GA Realtime/DebugView and the ecommerce reports (normal reporting delay).

For rollback, restore the prior frontend first. The extra metadata and read-only
function can remain without changing checkout/payment behavior.

## Verification

- `node --test tests/unit/purchaseAnalytics.test.mjs tests/unit/purchaseConfirmation.test.mjs`
  covers server binding/status/amount validation, discounts, payload allowlisting,
  secret cleanup, consent, storage errors, reload dedup, cart preservation, and
  actual confirmation-component effects for pending/failure/unmount/legacy flows.
- `npm run build` and `npm run routes:check`.
- Whole suite: pre-existing `storefrontPricing.test.mjs` expects $15 shipping and
  a $40 total although current checkout constants specify $20/$45. Do not alter
  pricing as part of analytics work.
- Browser suite prepared but not executed here: Chromium was blocked by sandbox
  socket restrictions, and the one requested escalation failed in environment
  setup at a read-only protected session path. No workaround was attempted.

Offline browser setup (all external requests are mocked/blocked):

```sh
VITE_SUPABASE_URL=https://mockref.supabase.co \
VITE_SUPABASE_ANON_KEY=offline-anon-fixture \
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_offlinefixture \
npm run dev -- --host 127.0.0.1 --port 4175
# In another terminal, supply an existing Playwright install and Chromium:
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_PATH=/path/to/chromium \
node tests/browser/purchaseAnalytics.mjs
```

## Separate existing webhook concern (not modified)

Read-only inspection of deployed `stripe-webhook` v18 found the same synchronous
`constructEvent` call as the repository, despite the Stripe Deno crypto provider's
async verification requirement. It also acknowledges order-update errors with
HTTP 200. This is a source-level risk, not a claim of observed live failures.
The existing browser fallback is preserved (now verified) rather than making
fulfillment newly depend only on this webhook. Investigate separately before
removing the fallback or promising reliable fulfillment without a browser return.

References: [GA ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce),
[transaction deduplication](https://support.google.com/analytics/answer/12313109),
[consent mode](https://developers.google.com/tag-platform/security/guides/consent),
[Stripe payment status](https://docs.stripe.com/payments/payment-intents/verifying-status),
[Supabase Stripe webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks).
