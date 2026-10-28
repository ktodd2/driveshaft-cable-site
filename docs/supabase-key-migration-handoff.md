# Draft only: owner-operated credential handoff

Scope: driveshaftcable.com / Supabase twrihhyfvomqiqbxkitc. Do not deploy this draft or disable legacy keys yet. It deliberately has no legacy key fallback. No credentials or production configuration have been changed by this work.

## Can the owner keep all credentials outside the assistant?

Yes. The owner can create/copy/store values directly between Supabase, Render and their private password manager, without sharing values, screenshots, terminal commands, SQL literals or credential-filled pages with the assistant. The assistant must not inspect these pages while values are visible. Close or mask credential dialogs before returning control. Only report completion, key names/IDs and timestamps.

This is a staged handoff, not a request to complete the cutover now. The remaining code/authentication and live deployment gates below must be resolved first.

## Owner preparation (new, initially unused settings)

1. Open https://supabase.com/dashboard/project/twrihhyfvomqiqbxkitc/settings/api-keys yourself. Select **Publishable and secret API keys** under **Settings → API Keys**. This route/tab is documented by Supabase; credential-bearing dashboard UI has not been inspected. Create one publishable key named `store_web` and one secret key named `store_backend`. Existing `default` keys are not changed or deleted. Record the new IDs privately. Never copy the secret key into any VITE variable.
2. In Edge Functions → Secrets, confirm the platform injects `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS`. The draft reads `store_web` / `store_backend` from these dictionaries. Do not manually overwrite reserved SUPABASE_* variables. If the named dictionaries are unavailable, use the native secret fields to set `STORE_SUPABASE_PUBLISHABLE_KEY` and `STORE_SUPABASE_SECRET_KEY` to the corresponding new keys instead. These overrides are optional, not additional credentials.
3. In this project's Vault native secret form, create `store_backend_api_key` containing the new backend key. Do not enter a key as a literal in SQL or a cron command. It will be read inside the database at execution time.
4. In Render, select only the existing service serving driveshaftcable.com. Environment → Add Environment Variable: `VITE_SUPABASE_PUBLISHABLE_KEY` = the new publishable key. Choose **Save only**. Keep `VITE_SUPABASE_URL` and the existing legacy variable unchanged during overlap. Do not rebuild/deploy yet. The exact service ID and current deployment remain to be verified before this step.
5. Generate a fresh high-entropy random worker token privately (for example 32 random bytes using a password manager). This is not a Supabase API key. Store it in that password manager and in Supabase Vault as `ga4_worker_token`. It is initially unused. Do not overwrite the active `GA4_WORKER_TOKEN` yet. Do not rotate `CRON_TRIGGER_KEY`, NETMON tokens, Stripe, Resend, or other credentials.

Required destinations at cutover:

| Value | Destination | Use |
|---|---|---|
| store_web publishable key | Render `VITE_SUPABASE_PUBLISHABLE_KEY`; Edge named dictionary or optional override | Browser/API client, user-scoped Edge clients |
| store_backend secret key | Edge named dictionary or optional override; Vault `store_backend_api_key` | Privileged DB clients and authenticated backend calls |
| Dedicated random GA4 token | Edge `GA4_WORKER_TOKEN_V2`; Vault `ga4_worker_token` | Worker authentication only |

## Credential-free cron configuration to prepare

The following are header expressions, not complete runnable cron replacement commands. Preserve each job's original URL, body, timeout, schedule and name after a safe server-side inspection; do not print commands to inspect them.

For jobs 2 (blog) and 4 (testimonial), use a backend `apikey` header referencing Vault:

```sql
'apikey', (select decrypted_secret from vault.decrypted_secrets
           where name = 'store_backend_api_key')
```

Remove the corresponding legacy API-key bearer header, but only after the target function has an explicit machine-authentication guard and its gateway configuration has been reviewed. The testimonial and blog drafts now compare the configured backend key and validate active admin membership for user callers. Do not change either cron before coordinated deployment.

For job 28 (GA4), retain its dedicated bearer-token mechanism and use:

```sql
'Authorization', 'Bearer ' ||
  (select decrypted_secret from vault.decrypted_secrets
   where name = 'ga4_worker_token')
```

Only during the coordinated cutover, briefly pause job 28, confirm the unused Edge `GA4_WORKER_TOKEN_V2` was privately staged earlier with that same token, deploy the reviewed worker with gateway settings compatible with its dedicated token, update job 28's Vault reference, verify authentication without claiming/sending purchases, then restore its existing every-minute schedule. The current live gateway has verify_jwt=true; a random worker token cannot simply replace the JWT under that configuration. The in-code token check must remain active. Do not manually invoke the worker as a test; pending real purchases could be sent.

Jobs 21–26 must be identified through safe equality/metadata checks before changing them. They may use the separate `CRON_TRIGGER_KEY`. Job 27 has no HTTP credential dependency. Do not invoke setup-cron-jobs during migration: it changes schedules. The draft now adds caller authorization and removes raw cron configuration from its response.

## Draft implementation and outstanding gates

- Frontend/raw REST calls use the new publishable variable and apikey header. The SDK transport removes only a bearer copy equal to the configured modern API key, preserving user JWTs and dedicated tokens.
- Edge DB clients read named modern keys; seven existing machine-auth branches compare the backend key on apikey instead of a service-key bearer token. Existing CRON_TRIGGER_KEY and user-session branches are preserved.
- No gateway settings were changed. Do not blanket-disable verify_jwt. Public routes need a reviewed public-access decision; protected routes need explicit in-code user/role or machine-token checks first.
- The draft now uses the existing AdminLoginPage authority: a validated user must have an active matching admin_users row. Live metadata confirms RLS and only an own-row SELECT policy on that table. No identities were read. Offline tests reject user_metadata admin claims without that row.
- Explicit backend/active-admin guards now protect generate-blog-post, check-tracking-status, setup-cron-jobs, send-tracking-email, send-delivery-email and finalize-tax-transaction. Only check-tracking-status additionally accepts the existing cron token. Public endpoints and all gateway settings still need deployment validation.
- Preserved live-only source: newsletter-confirm version 7, live-wall-stats version 8, netmon-ingest version 6, netmon-status version 6. Their existing independent authorization is retained. Local copies are outside the repository in task-4/live-source-backup; the live-wall source was sanitized after the independent review found an embedded token. All 27 live functions (40 bundled files) were subsequently reconciled against the draft base. The only additional live drift was confirmed-subscriber filtering in marketing/welcome emails and the $400 welcome-email shipping threshold; both are now preserved. Recheck version/hash metadata immediately before deployment.
- The frontend deployment, Render service settings, cached browser tabs, auth/storage clients, external consumers, current SDK behavior, and real role-gated access remain to be verified.
- Stage/deploy only after review. Validate public access, user/role rejection, backend zero-row reads, no-order checkout paths, no-send job auth, and valid/invalid webhooks without charges/emails/fake analytics. Then independently review the final implementation.
- Disable legacy anon/service_role together only after all gates pass. Verify rejection with safe non-data-returning checks. Never rotate JWT signing keys or automatically re-enable compromised legacy access as rollback.

## Validation and evidence

Draft unit suite: 113 passing tests, including credential resolution and transport cases. Build and 31-route inventory pass; all 30 Edge TypeScript files pass syntax transformation. No repository lint/typecheck scripts exist; syntax transformation is not full Deno type checking. Build ran without live credentials and skipped dynamic blog sitemap fetching. No production auth/checkout/email/worker checks were run. A separate implementation review pass and offline authorization tests are recorded in supabase-key-migration-review.md. Independent second-reviewer approval covers the offline implementation at33e31cdfd0c9a8660156cab14cd39db470858c3b; production validation remains outstanding.

Official references:

- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/database/vault
- https://render.com/docs/configure-environment-variables
- https://supabase.com/docs/reference/api/v1-update-project-legacy-api-keys

## Additional independent-review hold: live-wall token

The independent reviewer found a hardcoded WALL_TOKEN in the imported live-wall-stats source and inadvertently printed that line during review. The value is not repeated here. It has been replaced with a LIVE_WALL_TOKEN environment lookup in the draft and removed from retained source snapshots and unpublished draft history. Do not deploy live-wall-stats until separately authorized remediation configures and rotates its token plus all callers. No live-wall credential was changed. This is additional exposure; disabling legacy Supabase keys does not invalidate that independent token.

## Live-wall scope update and caller-discovery result

Owner approved identifying live-wall display/client connections and replacing only that token plus its legitimate callers on 2026-10-28 at04:02UTC. This supersedes earlier statements that separate remediation lacked approval. Execution remains held until callers are identified and the browser credential-entry handoff is completed.

A filename/reference-only search across the authorized repository found only the endpoint itself, migration documentation and offline tests—no display/client caller. Metadata-only SQL found no cron jobs or public/private database functions referencing live-wall-stats. No matching source lines, token values, browser credential pages, unrelated repositories or raw request logs were inspected/output.

Precise gap: the external display/client deployment location and credential storage are unknown. Minimum owner question: “Where do you open the live-wall statistics display—a website address, app, or particular screen/device?” A URL or device/app name is enough; do not request a token or screenshot.

Once identified, inspect only that named caller and its credential-field names through safe metadata; preserve the display's existing behavior and fetch timing. Stage LIVE_WALL_TOKEN securely, coordinate the caller and endpoint switch, then prove the previous token rejects without returning statistics and the legitimate display works. Keep unrelated NETMON_* tokens unchanged. Do not deploy or disable the endpoint before callers are ready. Both exposed credentials remain uninvalidated.

## Verified live-wall caller (supersedes discovery gap)

Owner identified https://houstontruckwreck.onrender.com/live. An unauthenticated GET redirects to /login. Filtered Render metadata confirms service houstontruckwreck, ID srv-d0v6i2a4d50c73e7f9rg, repository ktodd2/houstontruckwreck, branch main, web_service. Active deployment dep-db79llmi0phs738rj8t0 uses commit4fdff4d052d3dbdfb38b94d4e0bc23e66ad51d38; the inspected repository commit matches that deployment.

Only targeted code was processed in memory to produce filename/line/identifier/boolean metadata; no raw source, scripts, headers or credential values were printed or saved. Existing credentials and Render environment values were not read.

Verified dependency chain:
- templates/live.html fetches the same-origin /api/live route. It contains no direct live-wall endpoint/project reference or live-wall credential identifier.
- app.py:620 defines /live; app.py:627 defines /api/live. Both have login_required decorators.
- app.py:582 _fetch_store_stats uses STORE_STATS_URL, STORE_STATS_TOKEN and STORE_STATS_CACHE_SECONDS, sends a server-side bearer header and parses the stats response. It does not return its configuration token.
- config.py:41 reads STORE_STATS_URL with a default pointing to the scoped Supabase live-wall endpoint; config.py:44 reads STORE_STATS_TOKEN with no nonempty literal default; config.py:45 reads STORE_STATS_CACHE_SECONDS.

The proxy already keeps this credential server-side. No Houston architecture rewrite or unrelated code change is needed. Actual Render STORE_STATS_TOKEN presence/value and owner-authenticated display health were not inspected and remain verification steps.

Bounded remaining work: privately stage the replacement token in Supabase LIVE_WALL_TOKEN and the identified Render service's STORE_STATS_TOKEN; keep STORE_STATS_URL, cache settings, login credentials, NETMON_* and other settings unchanged. Coordinate the reviewed endpoint deployment and a deployment of the existing Houston build with its updated token; do not accidentally deploy newer unrelated repository changes. Cross-provider credential replacement is not atomic, so plan the switchover window explicitly (existing response caching is not a zero-downtime guarantee). Do not switch either endpoint/caller before both sides are prepared. Then confirm valid caller behavior and old-token rejection with non-data-returning checks. Endpoint draft also requires modern Supabase backend-key setup, so coordinate that prerequisite with the broader migration. No production change has occurred.

## Current worker staging plan (supersedes active-token replacement instructions)

The replacement Vault ga4_worker_token now exists exactly once. To remove the need for owner credential entry during a paused cron window, the draft worker reads only GA4_WORKER_TOKEN_V2, with no fallback to the exposed GA4_WORKER_TOKEN. The owner can privately add GA4_WORKER_TOKEN_V2 to Edge Secrets now, using the same saved Driveshaft GA4 worker password. Existing live code still reads GA4_WORKER_TOKEN, so staging V2 does not change its authorization. Leave the existing token and current cron/Vault reference untouched at this stage.

After named-key runtime readiness and review gates pass: pause job28 for a bounded cutover; deploy the reviewed worker with the staged V2 setting and appropriate gateway configuration; switch cron to Vault ga4_worker_token; perform no-claim authorization validation; restore the original minute schedule and check health. No private credential entry is needed during this window. On failure, keep the job paused only as necessary for a reviewed modern-credential recovery; never silently reactivate compromised access. Remove the unused legacy custom worker secret only after successful validation, through the protected owner handoff.
