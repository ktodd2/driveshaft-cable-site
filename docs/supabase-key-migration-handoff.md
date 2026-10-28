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
| Dedicated random GA4 token | Edge `GA4_WORKER_TOKEN`; Vault `ga4_worker_token` | Worker authentication only |

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

Only during the coordinated cutover, briefly pause job 28, privately replace Edge `GA4_WORKER_TOKEN` with that same token, deploy the reviewed worker with gateway settings compatible with its dedicated token, update job 28's Vault reference, verify authentication without claiming/sending purchases, then restore its existing every-minute schedule. The current live gateway has verify_jwt=true; a random worker token cannot simply replace the JWT under that configuration. The in-code token check must remain active. Do not manually invoke the worker as a test; pending real purchases could be sent.

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
