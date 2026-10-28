# Deployment worksheet — held, no production actions

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
| live-wall-stats | 8 | false | HOLD: newly exposed separate token; draft requires nonempty LIVE_WALL_TOKEN; rotation/callers need separate authorization |
| netmon-ingest | 6 | false | Existing NETMON_INGEST_TOKEN |
| netmon-status | 6 | false | Existing netmon status token |
| newsletter-confirm | 7 | true | Newsletter confirmation token |
| newsletter-subscribe | 8 | true | Intended guest/public workflow; preserve existing payload/business validation |
| process-testimonial-queue | 11 | true | Configured backend apikey or validated active admin_users membership |
| report-purchases | 8 | true | Dedicated GA4_WORKER_TOKEN; never backend-key substitution |
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
6. Coordinate worker job28: pause, owner updates active Edge GA4_WORKER_TOKEN from privately staged dedicated token, deploy reviewed worker with compatible gateway flag, switch Vault reference to ga4_worker_token, verify auth without claiming rows, resume original every-minute schedule. Preserve durable outbox and do not backfill.
7. Rebuild the frontend using VITE_SUPABASE_PUBLISHABLE_KEY only after backend callers/gateways are ready. A plain redeploy of old static assets does not substitute new Vite build variables.
8. Run safe live checks: intended anonymous access, active-admin login, ordinary-user rejection, backend zero-row reads, storage authorization, checkout code paths without order creation, valid/invalid webhook checks without events/charges, and scheduler authentication without sends. Verify normal scheduled health through metadata, not response payloads.
9. Only after every dependency and validation passes, disable the legacy anon/service_role pair. Do not rotate JWT signing keys. Verify old access is rejected with non-data-returning requests and replacement paths remain healthy.
10. Rollback must not silently reactivate compromised legacy access. Prefer a tested modern-key build/config rollback; pause affected work and obtain informed approval for any fundamentally different recovery action.

No live validation is claimed by passing offline tests. Record exact deployed commit, function versions, Render deployment ID, cron change IDs, key metadata and test results at execution time.
