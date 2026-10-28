# Deployment worksheet and execution record

Do not execute this worksheet until protected credential setup, independent review and live validation gates are satisfied. Gateway decisions are endpoint-specific; no bulk gateway toggle is authorized by this worksheet.

| Function | Captured live version | Live verify_jwt | Draft authority / intended caller |
|---|---:|---|---|
| analytics-webhook | 6 | false | Analytics Stripe signature |
| calculate-tax | 13 | true | Intended guest/public workflow; preserve existing payload/business validation |
| check-tracking-status | 8 | true | Configured backend apikey or validated active admin_users membership; existing CRON_TRIGGER_KEY also allowed |
| create-payment-intent | 23 | true | Intended guest/public workflow; preserve existing payload/business validation |
| dispatch-campaigns | 7 | true | Configured backend apikey or validated active admin_users membership; existing CRON_TRIGGER_KEY retained |
| finalize-tax-transaction | 8 | true | Configured backend apikey or validated active admin_users membership |
| generate-blog-post | 22 | true | Configured backend apikey or validated active admin_users membership |
| live-wall-stats | 8 | false | HOLD: newly exposed separate token; draft requires nonempty LIVE_WALL_TOKEN; bounded rotation now approved; caller identification and protected entry pending |
| netmon-ingest | 6 | false | Existing NETMON_INGEST_TOKEN |
| netmon-status | 6 | false | Existing netmon status token |
| newsletter-confirm | 7 | true | Newsletter confirmation token |
| newsletter-subscribe | 8 | true | Intended guest/public workflow; preserve existing payload/business validation |
| process-testimonial-queue | 11 | true | Configured backend apikey or validated active admin_users membership |
| report-purchases | 8 | true | Dedicated GA4_WORKER_TOKEN_V2 in draft; existing worker remains on GA4_WORKER_TOKEN until cutover |
| send-abandoned-cart | 12 | false | Configured backend apikey or validated active admin_users membership; existing CRON_TRIGGER_KEY retained |
| send-delivery-email | 8 | true | Configured backend apikey or validated active admin_users membership |
| send-marketing-email | 21 | true | Configured backend apikey or validated active admin_users membership; existing CRON_TRIGGER_KEY retained |
| send-quote-notification | 18 | true | Intended guest/public workflow; preserve existing payload/business validation |
| send-reorder-reminder | 11 | false | Configured backend apikey or validated active admin_users membership; existing CRON_TRIGGER_KEY retained |
| send-tracking-email | 20 | true | Configured backend apikey or validated active admin_users membership |
| send-welcome-series | 12 | false | Configured backend apikey or validated active admin_users membership; existing CRON_TRIGGER_KEY retained |
| send-winback | 11 | false | Configured backend apikey or validated active admin_users membership; existing CRON_TRIGGER_KEY retained |
| setup-cron-jobs | 9 | true | Configured backend apikey or validated active admin_users membership |
| stripe-webhook | 23 | false | Stripe signature |
| track-order | 7 | true | Existing order-tracking lookup validation |
| validate-discount-code | 9 | true | Intended guest/public workflow; preserve existing payload/business validation |
| verify-purchase | 7 | true | Bound checkout payment capability; read-only verification |

## Ordered cutover gates

1. Recheck latest main, active user work, all live versions/hashes and exact Render service/domain before changing anything. Keep this isolated branch; do not overwrite competing work.
2. Owner performs native credential entry/submission under browser handoff requirements. Assistant receives only names/IDs and completion metadata. Prefer platform named key dictionaries to avoid redundant secret copying. Prepare unused Vault entries and Render Save only configuration. Do not replace active GA4 token yet.
3. Confirm complete consumers: browser and cached tabs, sitemap/build, SDK clients, all Edge bundles, nested Edge invocations, auth/storage access, cron/Vault, public DB triggers, and external integrations. Unverified consumers block retirement.
4. Review each gateway setting against the authority in the table. Modern apikey-only and dedicated-token calls need a compatible gateway configuration; existing signed user JWTs must still be verified in code against active membership. Existing false flags are not a reason to loosen any in-code guard.
5. Stage backend deployments with required named keys already present. Coordinate changes to jobs 2/4/21–26 with their target handlers; preserve schedule/body/timeout and existing independent cron tokens. Pause affected jobs only for the bounded switch if overlap cannot be authenticated. Never manually invoke sending jobs as a probe.
6. Coordinate worker job28: first confirm owner already staged unused Edge GA4_WORKER_TOKEN_V2 from the dedicated token; only then pause and deploy reviewed worker with compatible gateway flag, switch Vault reference to ga4_worker_token, verify auth without claiming rows, resume original every-minute schedule. Preserve durable outbox and do not backfill.
7. Rebuild the frontend using VITE_SUPABASE_PUBLISHABLE_KEY only after backend callers/gateways are ready. A plain redeploy of old static assets does not substitute new Vite build variables.
8. Run safe live checks: intended anonymous access, active-admin login, ordinary-user rejection, backend zero-row reads, storage authorization, checkout code paths without order creation, valid/invalid webhook checks without events/charges, and scheduler authentication without sends. Verify normal scheduled health through metadata, not response payloads.
9. Only after every dependency and validation passes, disable the legacy anon/service_role pair. Do not rotate JWT signing keys. Verify old access is rejected with non-data-returning requests and replacement paths remain healthy.
10. Rollback must not silently reactivate compromised legacy access. Prefer a tested modern-key build/config rollback; pause affected work and obtain informed approval for any fundamentally different recovery action.

No live validation is claimed by passing offline tests. Record exact deployed commit, function versions, Render deployment ID, cron change IDs, key metadata and test results at execution time.

## Executed worker stage — 2026-10-28 UTC

Owner privately staged GA4_WORKER_TOKEN_V2. A short-lived, V2-authenticated GET-only readiness function verified the named store_backend/store_web dictionary entries, zero-row backend/public Data API requests, worker/Vault token equality, GA4 and Stripe setting presence, and enabled delivery. All eight boolean checks passed. Independent reviewer exercised ten offline probe scenarios. Request 21866 returned HTTP 200 with all allowlisted flags true. Probe migration-readiness-20261028 was deleted immediately; function inventory confirmed absence and count 27. No values, hashes of credentials, response bodies, or headers were returned.

Job 28 was briefly paused while deploying report-purchases from code commit 81072868ccb45ff2bb17705a647158c8ba41faa6. The first bundle attempt failed before deployment because a transitive helper was omitted; adding the existing reviewed purchaseAnalytics.js resolved the bundle. Successful worker deployment: version 12, function ID b3b62ecf-65fb-4c83-8dc0-286126f3f847, bundle SHA256 b3df528d3d48c6ce838483adec5be0465701553859d5350b69b9c4ef3b05e83f, verify_jwt=false with mandatory V2 in-code authentication. Uploaded entrypoint plus supabaseKeys.js, supabaseTransport.js, ga4Outbox.js, purchaseAnalytics.js.

Cron command changed only its Vault reference from ga4_worker_service_role to ga4_worker_token. Protected server-side GET request 21869 returned 405; unauthenticated GET 21870 returned 401. GET exits before DB initialization, claims, or sending. Job 28 was resumed with active=true and unchanged every-minute schedule. No manual POST, fake purchase, backfill, or email test occurred. Current worker rejects the original setting by construction; legacy project API keys and old stored credentials have not been revoked. Broader frontend/backend/job and live-wall migrations remain pending their separate gates.

The first natural resumed run at 04:53 UTC produced response 21871: HTTP 200, no timeout, and the boolean check for No pending purchases was true. This verifies idle worker operation through the modern backend key, not an end-to-end GA receipt from a real purchase.


## Broader migration checkpoint — 2026-10-28, approximately 05:11 UTC

Code commit 1259a736c3c343342d4d75a864a1a2a4cccfb4e9 adds reviewed POST-only guards after authentication to nine scheduled/admin handlers. 122 tests pass; frontend build and 31-route check pass. Thirteen protected/admin/cron functions and eight public functions were deployed. The eight public endpoints retain verify_jwt=true. The protected guards verify the backend apikey, active admin membership, and existing independent cron token only where intended.

A second temporary readiness probe confirmed the backend Vault entry matches the runtime key, all six cron tokens match CRON_TRIGGER_KEY, and an actual publishable-key-only checkout request passes the existing gateway and returns the expected missing-orderId guard. Probe deleted and absence verified. Jobs21–26 retain their tokens/commands/schedules. Jobs2/4 were briefly paused, migrated to apikey headers resolving store_backend_api_key from Vault, positively checked with side-effect-free GET, and resumed on their original schedules. All ten expected cron jobs are active.

Safe verification: four authenticated empty POST bodies returned400 before sends/transactions; fifteen authenticated GET checks returned405 before work. Public checks21910–21917 passed their expected 400/405/200 responses; checkout missing-ID guard and discount valid:false checked as booleans. These public checks used the server-held backend apikey, not a browser session; separate publishable-key compatibility was tested above. Homepage, products/driveshaft-cable-plus and admin/login HEAD requests returned200 HTML. No signed-in browser functionality or complete checkout was exercised.

Analytics webhook deployment was initially denied twice. Owner then explicitly approved its credential-only update; deployment succeeded as version10. GET request21920 returned405 with no timeout and no event processing. Payment webhook stripe-webhook deployment was subsequently denied by automatic approval review because of its payment-fulfillment capabilities and lack of target-specific approval. netmon-ingest deployment was denied for its telemetry RPC writes and disputed target scope. No alternate route used; netmon-status was held rather than attempted after the monitoring denial. Fresh metadata shows all three unchanged. live-wall-stats remains unchanged pending coordinated owner credential staging.

Exact function versions and bundle hashes are recorded in supabase-migration-live-state-2026-10-28.json. Frontend has not been pushed/published. Legacy keys remain enabled, and both exposures remain uninvalidated. Remaining deployment approval requested should explicitly cover credential-only stripe-webhook, netmon-ingest, and netmon-status changes, preserving business/signature/token logic and performing no test payments or telemetry. Live-wall staging and end-to-end owner login/storage/checkout verification remain separate gates before retirement.
