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

## Approved remaining targets and frontend release — 2026-10-28, 05:20 UTC

Owner explicitly approved credential-only stripe-webhook, netmon-ingest and netmon-status updates. Each unchanged live hash was confirmed first. Deployments succeeded: stripe-webhook27, netmon-ingest10, netmon-status10. No independent token or business/signature/telemetry logic was changed. Unsigned webhook GET returned400; monitoring wrong-method probes returned405; no payments, events or telemetry were submitted. Previous approval-review blockers are resolved. Only live-wall-stats remains on its pre-migration version11.

An isolated frontend-only worktree/branch was created from current remote main. It contains no Edge entrypoint changes. Added a Render-only prebuild gate that rejects missing, legacy, secret-key or wrong-project configuration, verifies publishable-key access with a fixed zero-row products query, rejects redirects and emits no values/upstream errors. Independent review and82 exact-release tests passed, along with build and31-route inventory. Branch security/publishable-storefront head bc56b3d3cbbe75d9a81858b1f68bf48571b77298 was pushed and PR9 merged as fc8ba1aad480ede81450821356e4026b401992c8. Render automatically deployed dep-dbgobj942hec739591cg, live at05:19:32UTC. No redundant deploy was triggered.

Post-live homepage, product /products/driveshaft-cable-plus and /admin/login HTML returned200 with app roots; referenced JS/CSS assets returned200. No scripts were executed for these checks. This confirms deployment/asset availability, not signed-in workflow behavior. Render's successful build includes the prebuild runtime key validation. The broad migration branch was merged with released main;127 tests now pass. All ten expected cron jobs remain active. Temporary diagnostic is absent. No exposed credential has been claimed fully invalidated, and legacy keys remain enabled.

Next owner-only staging step: generate/save a separate64-character letters/numbers password in 1Password item Driveshaft live wall (unless already completed). Future coordination must stage the same replacement privately for the existing Supabase endpoint and Houston server-side caller before switching either. Do not update active Render STORE_STATS_TOKEN early. Authenticated admin/storage/checkout owner checks, live-wall migration, remaining-consumer verification and final legacy retirement are still pending.


## Live-wall cutover — 2026-10-29

Owner privately staged LIVE_WALL_TOKEN, then saved the same password to Houston STORE_STATS_TOKEN using Save only. Presence-only probe23392 returnedtrue and was deleted. Live-wall source hash stayed unchanged before cutover. Independent review, tests127/127, Houstonmain/livecommit equality and no competing deploy were confirmed.

Supabase live-wall-stats version13 deployed with LIVE_WALL_TOKEN-only authentication and modern backend credentials; bundle hash8a13269c98a8e208bc0b104e6f69263c08319f51cefa1dd8001dfb378a562fbd. Initial Houston redeploy could not start because Render required explicit workspace selection. The owner explicitly confirmed My Workspace (tea-d0ur0dvdiees73acn7p0); only then was the held redeploy retried. No duplicate deploy existed. Deploymentdep-dbhbrmo8v5cc738218eg used unchanged application commit4fdff4d052d3dbdfb38b94d4e0bc23e66ad51d38 and became live at03:31:59UTC. The statistics feed may have been interrupted during the workspace-confirmation gap. No exposed-token rollback occurred.

Protected temporary probe23407 returned HTTP200 with new_token_accepted=true and missing_token_rejected=true. The probe internally called the fixed read-only wall feed; bodies were discarded and only booleans returned. Probe deleted; absence and27-function count verified. Exact retired-token HTTP rejection was NOT tested because its value was not retrieved under the secret-handling boundary. Deployed code removes the old hardcoded-token path, but this is distinct from an actual request with that retired token.

The normal Houston/live browser page required private admin login; no credentials were entered or read. Owner confirmation of fresh visible store statistics remains pending. All legacy API keys remain enabled. No PR was approved, no payment/event/telemetry/email test occurred, and no unrelated token changed.


## Owner workflow confirmation and source preservation — 2026-10-29

Owner reports the real Houston live-wall display works, and separately confirms store admin login, product images and opening checkout without submitting an order. These are owner-reported workflow checks, distinct from automated endpoint tests. All27 live bundle hashes and gateway flags match the reviewed manifest; all10 cron jobs remain active. Exact retired-wall-token HTTP rejection remains untested under the no-retrieval boundary.

Owner explicitly authorized publishing this reviewed backend migration as a draft PR only. Main e90c6a75eb07ce54bcc7edcd20e7dc60cfb92dee was merged locally to retain its environment-example/README correction.127 tests pass. No merge, PR approval or new deployment is authorized by the draft-publication step. Database cleanup preparation is held separately and is not an executable part of this source-preservation PR. Legacy key disablement has owner authorization after prerequisites, but has not occurred.
