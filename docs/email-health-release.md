# Priority 6: local release candidate (not published)

Based on verified main 0b63b87ed84aa3fc13467dfa46366eda60937ad5, cloned November 1, 2026. No homepage, inventory, quote-history, shipping-reconciliation, contribution calculation or scheduled cadence changes.

## Implementation

- New automation_runs and email_attempts tables; no inferred historical backfill.
- Execution records for recovery, welcome, reorder, win-back, campaign scheduling and delivery tracking. Run status, last attempted and last completed without reported errors, batch counts and known skip reasons.
- Durable per-message acceptance/rejection/uncertainty records for recovery, welcome, reorder, win-back and tracking-email-v2. Provider IDs retained. No body, subject, recipient address, credentials or provider error payloads logged in the new ledger. Opaque entity IDs support admin reconciliation; SHA-256 identity enforces deduplication.
- Database unique claim before provider call; storage outage fails closed. Concurrent or repeated pending/uncertain/rejected attempts cannot silently resend. Confirmed acceptance can be reused to finish an existing legacy status update without another provider call. Existing tracking provider idempotency keys are preserved for in-flight compatibility.
- Active-admin-only read RPC, top-level health UI and order-level tracking history. UTC timestamps, stale evidence and stale snapshot warnings, empty/error states. Read/refresh cannot send email. Existing campaign history and recovered-revenue/activity view retained with clearer labels.
- Eligibility selections and active/confirmed newsletter exclusions retained; failed eligibility lookups stop execution rather than treating unknown as eligible.

## Read-only production evidence

Supabase project twrihhyfvomqiqbxkitc; six email-related cron rows all active at audit:
recovery `5 * * * *`; welcome `*/15 * * * *`; reorder `0 14 * * *`; win-back `0 14 * * 1`; campaign scheduling `20 * * * *`; delivery tracking `0 9,17 * * *`. These are UTC schedules. No cron rows changed. Existing get_email_automation_stats derives its “last_run” columns from MAX customer send/stamp timestamps, not executions. Cron dispatch success does not establish edge completion or delivery. Edge function inventory and deployed tracking-email-v2 version 2 source inspected read-only (existing tracking idempotency key confirmed); no provider or sending endpoint was called.

## Limits requiring explicit understanding

- History begins at release. No inbox synchronization or delivery webhook exists in this change; provider acceptance is not delivery.
- Campaign and delivery routines get execution history, but their individual email outcomes remain in existing systems. Newsletter confirmation, quote notifications, legacy tracking endpoint, blog/testimonial and other non-email routines are not instrumented by this release. UI explains the campaign/delivery limitation.
- Uncertain/rejected messages require operator verification against provider evidence; this release intentionally has no resend or ledger-resolution control. A stopped process may leave pending/running records and cannot be assumed failed. No automatic timeout lease takeover.
- Only latest 100 run and attempt details are displayed; all-history summary timestamps are queried separately. No automatic retention deletion is introduced because deleting dedupe claims can allow repeat emails. Set a retention/archive policy before significant growth.
- Health staleness thresholds are conservative expectations from repository schedules, not a claim to read current scheduler settings live.
- Existing scheduled routines may update legacy status fields after provider acceptance. Their legacy activity counts are not delivery proof. New ledger protects duplicate calls even if a legacy update fails.

## Checks

208 unit tests passed, including mocked provider acceptance/failure, network uncertainty, concurrency/repeated requests, storage failure, skipped/ineligible batches and tracking identity guards. Isolated PGlite migration test passed active/non-admin/inactive/anonymous isolation, direct table denial, unique claim and saved order-filtered reads. Seven modified edge entrypoints parsed with Node TypeScript stripping (not a deployed Deno runtime test). Full frontend build and 31-route inventory passed. Playwright at 1440px and 390px passed reload persistence, empty/error/stale views, no horizontal overflow and read-only RPC-only requests; all external traffic blocked. Screenshots: /tmp/email-health-1440.png and /tmp/email-health-390.png. Build retains existing chunk-size warning and omits dynamic sitemap blog reads without local production environment.

## Approval required before release

Nothing pushed, merged, deployed or applied to production. No emails sent, schedules activated, subscriptions changed, credentials added or webhooks registered.

Approve these specific publication actions together after review:
1. Publish the reviewed repository changes through a PR and merge the approved revision.
2. Apply only supabase/migrations/20261101030000_email_health.sql to project twrihhyfvomqiqbxkitc. It creates two RLS-protected tables and indexes plus get_email_health(text). PUBLIC/anon/authenticated have no table access; service_role receives SELECT/INSERT/UPDATE only (including explicit revocation of broader default grants); only authenticated callers with admin_users.id=auth.uid() and is_active=true can read through the SECURITY DEFINER RPC with a fixed search_path. No customer/account data is migrated or changed.
3. Deploy the shared emailHealth.js module with these seven functions: send-abandoned-cart, send-welcome-series, send-reorder-reminder, send-winback, send-tracking-email-v2, dispatch-campaigns, check-tracking-status. Preserve current JWT/auth settings and secrets. Apply schema first; history failures otherwise stop instrumented work.
4. Publish the frontend and verify read-only admin views. Do not manually invoke customer sending endpoints. Existing schedules will naturally start recording future work after deployment.

Rollback: restore prior frontend/functions if necessary while retaining history tables and dedupe records. Do not drop or clear the ledger. Do not roll sending functions back live: old versions ignore the ledger and may resend accepted-but-unstamped or uncertain attempts. Keep the instrumented backend, or repeat the approved pause/drain/reconciliation procedure before rollback.


## Independent release review — overlap and permission corrections

All seven functions already exist and are ACTIVE (read-only inventory confirmed): recovery v17, welcome v17, reorder v16, win-back v16, tracking-email-v2 v2, campaign scheduling v12, delivery tracking v13. All currently have verify_jwt=false; retain their existing application authorization and this setting.

Corrections after review: legacy accepted-send stamp failures in recovery/reorder/win-back now produce review-required runs rather than apparent success; welcome already received the corresponding guard. New tables explicitly revoke service_role's potential default ALL grant, then grant only SELECT/INSERT/UPDATE. SQL tests simulate broad default grants and verify service writes/read succeed but DELETE/TRUNCATE fail; browser direct reads/writes fail for both tables. Added tests cover provider acceptance followed by ledger-write outage, concurrent tracking calls with different notification IDs but one saved revision, and original tracking key preservation. 208 unit tests and isolated SQL checks pass; build/routes rerun successfully.

### Cutover condition — not yet authorized or performed

The new ledger protects only requests running the new code. Existing scheduled invocations running old code can still send without a claim. A rolling deployment while those invocations run is NOT guaranteed duplicate-safe. Existing pre-release failed/uncertain sends also cannot be reconstructed from guesses.

Additional release approval must explicitly include a short guarded cutover: temporarily pause the six existing email-related cron jobs listed above, prevent manual invocations/tracking sends during the window, and drain old invocations using the actual project's maximum execution lifetime plus read-only execution/provider evidence. Do not guess a drain duration from cron success; the runtime limit and current in-flight state have not been verified. Reconcile evidence of any provider-accepted-but-unstamped or uncertain old attempts before allowing affected sends to resume. If evidence is unavailable, keep affected paths paused and report the blocker; do not invent history or replay sends.

Apply the schema first. Deploy all seven functions with the shared module while the pause remains, then publish the frontend. Verify only schema/grants, deployed code/metadata, authenticated history reads and UI. Restore precisely the originally active cron jobs to their original schedules ONLY as an expressly approved release action, not as verification. Resuming those existing schedules may naturally send eligible messages; no verification call may do so. No campaign activation, manual sends, provider webhook registration or subscription changes belong to this release.

Read-only inspection of the final natural scheduled run can follow later, without triggering it. If a temporary pause/resume is not approved, publication remains blocked unless independently verified quiescence and old-attempt reconciliation establish equivalent safety.

### Verification boundaries

Unit provider calls were mocks. Concurrency tests exercise the claim behavior with a shared mock store; the real unique constraint and access controls were separately executed in isolated PGlite. This is not proof of production PostgREST/Deno/provider execution. Frontend browser fixtures block external requests and only call a mocked read RPC. No production migration, deployment or permission test has run. Actual runtime drain limits, in-flight old invocations and historical provider uncertainties still require read-only reconciliation at cutover. A safe response cannot claim those are already resolved.


## Approved release preparation

User approved publication and an operational manual-send freeze. Final local correction records missing carrier credentials / unresolved tracking as review-required instead of a clean run. 208 unit tests, isolated SQL permissions, build and routes pass. No carrier secrets, recipients or campaigns are changed. Production application remains gated on the guarded cutover; this document records the reviewed procedure, not proof of deployment.


## Review regression fixes before publication

Confirmed P1 batch starvation and P2 out-of-order order-history response at head 89295ff. Added four service-only security-invoker views: email_candidates_recovery, email_candidates_welcome, email_candidates_reorder, email_candidates_winback. They exclude pending/uncertain/rejected attempts before existing source eligibility filters and LIMIT; accepted attempts remain eligible for legacy status reconciliation without another provider send. Win-back holds all candidate orders for the held order's email, so an older order cannot bypass the hold. New partial ledger index supports these checks. PUBLIC/anon/authenticated/service_role default view grants are revoked, then service_role gets SELECT only; base-table/RLS permissions remain in force. No new write RPC or browser access is introduced. The existing read RPC adds outstanding held-attempt counts, displayed separately from batch results.

History requests now use a generation guard invalidated on order changes, unmount and newer refreshes. Old success/error/completion callbacks cannot replace the current order's state.

Regression evidence: isolated SQL reproduces the original 50-held-record batch and verifies selection of the next 10 eligible records for welcome/recovery/reorder, service-only view access, and win-back older-order containment. Mocked desktop/mobile test delays order A until after order B loads and confirms B stays visible. 208 unit tests, isolated SQL, full build and 31 routes pass. No test message is sent. User approved scoped review fixes during guarded release. Jobs 21–26 paused at 18:30:14 UTC; only 21–25 are to be restored, with 26 left paused per separate explicit approval. This note is not a claim that deployment is complete.
