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
2. In GA property 526322589 / stream G-SDQTZK079P, Admin → Data streams → select the web stream → Measurement Protocol API secrets → Create. Obtain explicit approval for this credential creation. Store the value only as Supabase Edge secret `GA4_API_SECRET` on project `twrihhyfvomqiqbxkitc`; never in frontend env, Git, tool output, PR or chat. The secret was created and stored during the approved rollout. The debug validator does not prove a secret is valid.
3. Apply the new migration after review; run Supabase security advisors. Table/RPC grants are service-role-only, RLS enabled, no public policies and no SECURITY DEFINER. No orders-table changes or historical backfill.
4. Deploy `analytics-webhook` with JWT verification disabled (Stripe signature verification supplies authorization). Create a **separate** live Stripe snapshot webhook destination for `payment_intent.succeeded`, pointing to `https://twrihhyfvomqiqbxkitc.supabase.co/functions/v1/analytics-webhook`. Prefer the existing account's compatible event API version. This endpoint creation and its new signing credential require approval. Save only its signing secret as `STRIPE_ANALYTICS_WEBHOOK_SECRET`. Leave the existing stripe-webhook endpoint/subscriptions unchanged.
5. Deploy `report-purchases` with gateway JWT verification enabled; handler additionally requires the exact approved GA4_WORKER_TOKEN bearer (the existing service-role key stored separately from the runtime database credential). Configure an approved Supabase Cron job to POST this endpoint once per minute, keeping the existing service-role credential in Vault, never literal SQL/logs. Credential storage/scheduling require approval. One invocation drains one row (60/hour); increase invocation frequency/concurrency if traffic requires it and watch oldest pending age. Enable the schedule only after the authenticated worker check passes.
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

PR #6 merged as `621b822426e4940ce00fecf6da79f0a987884eed`; Render deployment `dep-dbgm42qjnfac739f7h50` is live. The updated frontend, create-payment-intent, verify-purchase, analytics-webhook, report-purchases and migration `20261028023731` are deployed. Original checkout's ADD_PRODUCTS.md remains untouched.

The owner approved the separate live Stripe destination, Google secret storage, minute worker schedule, Vault storage and Google User Data Collection Acknowledgement. Stripe destination `we_1UVMvLQVUN7Hl8vsSQNhdiWV` subscribes only to payment_intent.succeeded. Its signing secret and GA4_API_SECRET are stored in Edge secrets. The existing fulfillment destination was already disabled and was left unchanged.

The dedicated Vault entry `ga4_worker_service_role` holds the existing project service-role key. An authenticated request passed gateway JWT verification but failed the handler's exact comparison with SUPABASE_SERVICE_ROLE_KEY. This proves a credential mismatch, not its cause. The worker now compares the caller against separately configured GA4_WORKER_TOKEN and keeps the runtime service key exclusively for database operations. Gateway JWT verification remains enabled. The owner explicitly approved this additional storage. Missing configuration fails closed.

Activation is pending completion of GA4_WORKER_TOKEN storage, authenticated empty-queue verification, minute cron setup, GA4_DELIVERY_ENABLED, and finally GA4_SERVER_PURCHASES_ENABLED. No historical or synthetic purchase has been submitted. An empty-queue check does not prove GA delivery; reconcile the next genuine eligible sale.

All 77 tests, build, route checks, Deno checks, isolated SQL checks, and non-recording Google validation passed for PR #6. The authentication follow-up adds missing-token/runtime-key rejection scenarios and confirms database calls retain the runtime credential. No lint script or remote GitHub CI workflows are configured.

Security advisors: expected informational RLS-without-policy finding for the service-only outbox; no new security warning. Existing unrelated campaign/search_path/pg_net/public RPC/password advisories were left unchanged.
