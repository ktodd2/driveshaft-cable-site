# Durable GA4 purchases — staged rollout

## Diagnosis and evidence (2026-10-28)

Base: `82f21ce` on `ktodd2/driveshaft-cable-site/main`. Read-only inspection confirmed live `create-payment-intent` v17 and `stripe-webhook` v18 match their repository counterparts. No customer records were edited or fetched for this work.

The old path is Checkout → PaymentIntent metadata snapshot → buyer's success page → verify-purchase → browser gtag purchase. The Stripe webhook has no analytics delivery. A buyer who doesn't return, a closed/offline tab, or blocked tag can therefore leave a verified sale unreported. The browser writes its duplicate marker immediately after enqueueing gtag, not after confirmed GA receipt. These are evidenced code paths, not proof of the reason for the specific missing October 24 sale.

Both the server snapshot and browser allowlist omitted item_name, explaining `(not set)`. Revenue of 81 for a 101 order with 20 shipping is correct merchandise revenue, not an undercount of that order's value.

Historical order IDs supplied in the investigation are not backfilled. The prior QA order and all pre-rollout PaymentIntents lack `ga4_reporting=server_v1` and cannot enter this queue. Test-mode events/intents, pending/failed payments, invalid totals, and invalid order bindings are excluded.

## Behavior

- Checkout obtains actual GA client_id/session_id via gtag get, waiting at most 500 ms. No invented IDs, cookie scraping, email, address, customer names, user_id, IP or page URL are sent. It respects existing analytics-storage denial, GA opt-out and Global Privacy Control before and after capture. No tag callback means no server ownership.
- Existing site policy has no CMP/default denial. Capture preserves that policy; `allowed` means the existing policy allows analytics, not proof of an explicit consent grant. It does not override consent or blockers. Server delivery uses consent as captured at checkout; a later opt-out on a different page/device cannot automatically revoke an already queued event. Review this policy before enabling, and implement a server-side revocation mechanism if the consent product changes. Advertising use/personalization is explicitly DENIED in MP.
- Server pricing remains untouched. The existing integer-cent snapshot now includes names from the public products catalog, never client-written order item names. Missing catalog names fall back to `Product <id>`. Legacy v1 snapshots remain readable. Stripe's 500-character metadata value cap remains: an oversized snapshot is omitted, not truncated or allowed to break payment. Such baskets remain an explicit reporting limitation.
- `GA4_SERVER_PURCHASES_ENABLED=true` assigns server ownership only to new eligible PaymentIntents. verify-purchase returns no browser purchase for these intents, independent of later flag changes, so returning buyers cannot double-submit. Old/fallback payments still use browser tracking. Deploy the updated verifier before enabling the flag.
- A new, separately signed Stripe analytics destination durably inserts an order/intent key and paid timestamp. It has no payment, stock, tax, mail or fulfillment writes. Stripe retries a failed enqueue independently of fulfillment. Duplicate delivery cannot reset queue state; order and intent uniqueness enforce one row.
- Worker claims are atomic (`FOR UPDATE SKIP LOCKED`), service-role-only, leased and token-fenced. It re-reads Stripe and its expanded latest charge before sending; refunded (including partially refunded), disputed, unverified and ineligible charges are skipped. A refund after a purchase has been sent is not retroactively handled: a separate authorized refund-analytics project would be needed to report reversals. Refund/payment processing is unchanged.
- Amounts represent discounted merchandise with tax/shipping separate; cent allocation preserves sum(price × quantity). Original payment event time is used. No event older than 71 hours is sent. Recent real session IDs are included only within 24 hours of session start; engagement duration is not fabricated. Attribution/Realtime completeness is not guaranteed.
- Pre-send Stripe failures back off from 60 seconds to an hour; crashed preflight claims can be reclaimed. Before HTTP, state becomes `sending`. A timeout/crash or lost acknowledgment becomes `uncertain`; a non-2xx becomes `rejected`. Neither is automatically retransmitted. `submitted` means HTTP accepted, **not** confirmed GA processing. Blind retries would conflict with Google's guidance and risk duplicate counts. GA transaction_id is a secondary deduplication safeguard, not the sole safety mechanism.

## Rollout procedure (current completion recorded below)

1. Code publication/deployment has been approved. Credential creation/storage and workspace selection still require their specific confirmations before activation.
2. In GA property 526322589 / stream G-SDQTZK079P, Admin → Data streams → select the web stream → Measurement Protocol API secrets → Create. Obtain explicit approval for this credential creation. Store the value only as Supabase Edge secret `GA4_API_SECRET` on project `twrihhyfvomqiqbxkitc`; never in frontend env, Git, tool output, PR or chat. No secret was created, read, or persisted during preparation. The debug validator does not prove a secret is valid.
3. Apply the new migration after review; run Supabase security advisors. Table/RPC grants are service-role-only, RLS enabled, no public policies and no SECURITY DEFINER. No orders-table changes or historical backfill.
4. Deploy `analytics-webhook` with JWT verification disabled (Stripe signature verification supplies authorization). Create a **separate** live Stripe snapshot webhook destination for `payment_intent.succeeded`, pointing to `https://twrihhyfvomqiqbxkitc.supabase.co/functions/v1/analytics-webhook`. Prefer the existing account's compatible event API version. This endpoint creation and its new signing credential require approval. Save only its signing secret as `STRIPE_ANALYTICS_WEBHOOK_SECRET`. Leave the existing stripe-webhook endpoint/subscriptions unchanged.
5. Deploy `report-purchases` with gateway JWT verification enabled; handler additionally requires the exact existing service-role bearer. Configure an approved Supabase Cron job to POST this endpoint once per minute, keeping the existing service-role credential in Vault, never literal SQL/logs. Credential storage/scheduling require approval. One invocation drains one row (60/hour); increase invocation frequency/concurrency if traffic requires it and watch oldest pending age. No schedule has been created here.
6. Deploy updated `verify-purchase` first, then frontend and `create-payment-intent` with `GA4_SERVER_PURCHASES_ENABLED` unset/false. The verifier also reads the expanded charge and suppresses browser analytics for refunded/disputed/unverified charges. It remains read-only.
7. Confirm the worker, schema, signed destination and secret are ready. Set `GA4_DELIVERY_ENABLED=true`, then `GA4_SERVER_PURCHASES_ENABLED=true` last. Confirm consent/privacy policy suitability before activation. Do not replay pre-rollout sales or synthesize production purchases.
8. Observe the next genuine, consent-eligible live order: match its order ID to one queue row, Stripe succeeded event, and eventually one GA transaction with catalog item_name and expected merchandise/shipping/tax. Use Los Angeles GA reporting dates. Verify browser return does not issue a second purchase. No charge/order/email should be created solely for testing.

Pause/rollback: turn off `GA4_SERVER_PURCHASES_ENABLED` to stop assigning new server-owned intents; keep the verifier's ownership suppression and new webhook/worker running for already-owned payments. To pause delivery, disable `GA4_DELIVERY_ENABLED`; rows remain durable but expire after 71 hours. Never roll back the verifier while server-owned payments can still return. Never reset submitted/uncertain rows to pending without individually verifying delivery and explicit approval.

Monitor service-only queue state counts and oldest pending age; alert operationally on `uncertain`, `rejected`, expired/skipped rows, sustained pending backlog and failed Stripe deliveries. No alert recipients or messages have been configured. Queue rows have no GA identifiers or PII. Keep transaction deduplication tombstones so webhook replays cannot recreate completed work.

## Validation

- `npm test`: 77 tests pass (including full existing suite and new helpers/actual-handler tests).
- `npm run build`: passes. Existing >500 kB bundle-size warning remains; blog sitemap is skipped when local VITE_SUPABASE_URL/ANON_KEY are absent. No production env secrets were copied.
- `npm run routes:check`: 31 routes covered.
- Deno 2.5.6 `deno check` on analytics-webhook, report-purchases, create-payment-intent, verify-purchase: passes. A pre-existing unknown catch-variable type error in the touched payment-intent handler was narrowed with `instanceof Error`.
- `tests/integration/ga4Queue.mjs` executed against isolated PGlite 0.3.14: schema, anon/auth denial, service-role access, exclusive claims, lease recovery, stale-token rejection, crash quarantine, replay and unique intent checks pass. This is not a live Supabase/PostgREST concurrency/load test.
- `node scripts/validate-ga4-purchase.mjs`: Google **/debug/mp/collect** returned `{"validationMessages":[]}` under ENFORCE_RECOMMENDATIONS. This uses a synthetic fixture and placeholder secret; it does not record events, validate credentials, or prove production delivery.
- No lint command or frontend typecheck script is defined in this repository. During initial preparation, no production migration, deployment, credential change, schedule, charge, order, backfill or email was made. The subsequent staged rollout is recorded below.

For isolated SQL reproduction: install `@electric-sql/pglite@0.3.14` outside the app, then run `GA4_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/integration/ga4Queue.mjs`.

## Official references checked

- [GA MP transport, consent and response limitations](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference)
- [Sending events, client identifiers and API secret setup](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events)
- [Non-recording validation endpoint](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events)
- [GA purchase values and item fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/events#purchase)
- [Stripe signatures, retries and duplicate events](https://docs.stripe.com/webhooks)
- [Supabase Stripe signature verification](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase current TLS deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) reviewed; no relevant change to this implementation's APIs.


## Current deployment checkpoint

Code reviewed: `5d504565afff04178d06b652081d94e23e021819`. PR #6 remains draft/unmerged; no newer user commits or PR comments were found. Original checkout's untracked ADD_PRODUCTS.md is untouched.

After explicit deployment authorization, these components were deployed to `twrihhyfvomqiqbxkitc`:

| Component | Deployed version | Verification |
| --- | --- | --- |
| verify-purchase | 2 | Downloaded entrypoint/shared helper exactly match reviewed commit; gateway rejects unauthenticated requests |
| analytics-webhook | 1 | Downloaded entrypoint/shared helpers exactly match reviewed commit; unsigned POST returns 400 Invalid signature |
| report-purchases | 1 | Downloaded entrypoint/shared helpers exactly match reviewed commit; unauthenticated POST returns 401 |
| ga4_purchase_outbox migration | 20261028023731 | RLS true; anon SELECT false; authenticated INSERT false; service INSERT/claim true; anon claim false; queue count 0 |

Supabase assigned the migration version during application; the local filename was reconciled to that exact remote version to prevent future duplicate application. No order data changed. No fake event or authenticated worker invocation was sent.

Still unchanged: create-payment-intent v17, existing stripe-webhook v18, production frontend. Server reporting has not been activated. No GA API secret, Stripe destination/signing secret, Vault credential, or worker schedule was created. Secret-name inspection via the local Supabase CLI was unavailable because that CLI has no access token; the connected Supabase tools successfully handled deployment. Do not authenticate a new CLI or create an access token without the appropriate approval.

Specific pending confirmations:

- GA: create the Measurement Protocol secret for stream G-SDQTZK079P/property 526322589; store only in target Supabase project's GA4_API_SECRET. Scope: submit analytics events to this stream.
- Stripe: create a separate live payment_intent.succeeded snapshot destination at https://twrihhyfvomqiqbxkitc.supabase.co/functions/v1/analytics-webhook; store its signing secret only as STRIPE_ANALYTICS_WEBHOOK_SECRET.
- Supabase: store the existing service-role bearer securely in Vault and configure a once-per-minute POST to https://twrihhyfvomqiqbxkitc.supabase.co/functions/v1/report-purchases. No credential value may appear in SQL text, Git, chat or logs.
- Render: confirm My Workspace (ktoddllc1@gmail.com), ID tea-d0ur0dvdiees73acn7p0, before service inspection/deploy. The Render connector explicitly requires workspace confirmation; no Render service was changed.

All 77 tests, build, route checks, Deno checks, isolated SQL checks, and non-recording Google validation were repeated successfully. No remote GitHub CI statuses or workflow runs are configured for this PR. Repository has no lint script.

Security advisors before/after: only added finding is the expected informational RLS-without-policy for the service-only outbox. No new security warning. Pre-existing advisories remain for campaign function search_path, pg_net in public, public SECURITY DEFINER RPC access, and leaked-password protection; they were not modified. [RLS advisory explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Resume by obtaining the specific confirmations, completing protected setup and verifying it, deploying create-payment-intent and frontend with assignment disabled, then activating delivery followed by assignment. Do not claim full delivery until the next legitimate eligible sale is reconciled. Keep the stated consent snapshot and post-submission refund limitations explicit.
