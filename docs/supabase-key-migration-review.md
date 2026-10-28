# Migration draft review (no deployment approval)

An independent second agent reviewed the draft and independently ran its 110-test suite. It requested changes for a credential discovered in imported live-wall source; see the follow-up below. Production cutover is not approved.

## Live-source reconciliation

Retrieved all 27 functions and 40 bundled files from project twrihhyfvomqiqbxkitc. Compared their source to base 3b53d1a0a47cabf879d878c45debd8313a6e60a3 without printing credential-bearing configuration. The inventory records versions, bundle hashes, paths and local snapshot hashes.

Found and fixed two deployment-regression risks in the draft:

1. The deployed marketing function restricts newsletter subscribers to confirmed=true; Git lacked this restriction. Retained it.
2. The deployed welcome function restricts each of its three subscriber stages to confirmed=true and advertises free shipping above $400; Git lacked these changes. Retained all of them.

The other repository-backed files match live source, ignoring surrounding whitespace. Four live-only entrypoints were preserved in the draft. Snapshots are retained outside the repository for comparison. The live-wall snapshot has been sanitized after an embedded credential was discovered; it is not a pristine credential backup. Recheck remote main and live hashes before deployment.

## Authorization and transport review

- Named key lookup rejects missing/malformed/wrong-type configuration and never falls back to legacy credentials.
- Missing configured backend keys cannot authorize requests via empty/undefined equality.
- Modern API-key bearer copies are removed from SDK requests; actual user JWTs and dedicated tokens are retained. Raw browser and netmon REST requests use apikey.
- Seven backend machine-auth branches require the configured backend key on apikey. Existing separate cron tokens remain independent. Internal dispatch uses apikey.
- The GA4 worker still requires its dedicated GA4_WORKER_TOKEN and does not accept the backend credential as a worker token. Its existing offline tests cover no-claim rejection and delivery-disabled behavior.
- Existing webhook verification, purchase capability validation, netmon tokens and live-wall token checks were not relaxed.
- Gateway flags remain unchanged. This draft is deliberately not deployable until gateway/caller coordination is completed.

## Findings and remaining gates

1. RESOLVED IN DRAFT: Seven email functions previously accepted any authenticated user. AdminLoginPage already defines the authority: admin_users.id matches the authenticated user and is_active=true. Metadata-only SQL confirms those columns, RLS enabled, and a sole own-row SELECT policy. The draft now enforces the same rule. No user identities were read. Tests reject unprivileged users even with user_metadata.role=admin.
2. RESOLVED IN DRAFT: Added explicit backend/active-admin guards to generate-blog-post, check-tracking-status, setup-cron-jobs, send-tracking-email, send-delivery-email and finalize-tax-transaction. Only tracking status accepts the existing cron token. Moved Stripe initialization behind the finalization guard. Removed raw cron results and upstream error text from the setup response. Gateway settings remain unchanged pending deployment validation.
3. The GA4 worker gateway currently has verify_jwt=true. A fresh random worker token requires a coordinated, reviewed gateway update plus a brief scheduled-job pause, Edge secret update and Vault-reference switch. Neither the token nor this production mutation was performed.
4. Live Render settings, deployed browser bundles/cached tabs, external consumers, zero-row backend access, real role-gated login/storage access and production health checks remain unverified. Safe credential transport and staged deployment are required for those checks.

## Reproducible offline checks

- 113 unit tests pass. New handler tests exercise all seven existing machine-auth endpoints using absent credentials, public keys, wrong secret keys, legacy bearer fixtures and modern-key bearer fixtures. They reject before privileged DB work. Correct apikey reaches a mocked privileged boundary, which throws before any query, email or network call.
- Modern key resolution/SDK header tests cover malformed/missing configuration, user JWT preservation, dedicated token preservation and request body/header handling.
- Production frontend build and 31-route inventory pass. Build uses no live credentials and skips dynamic blog sitemap fetches.
- All 30 Edge TypeScript files pass esbuild syntax transformation; this is not Deno type checking. The repository defines no lint/typecheck scripts.
- No production test orders, charges, emails, analytics events, secret changes, deployments or legacy-key disablement occurred.

Result: the draft's identified source-regression defects are fixed and offline machine-authorization checks pass. Preparation remains held at credential transport, coordinated gateway/deployment validation and independent-second-reviewer gates, not at a tool denial or uncertain production write.

## Final credential-transport assessment

Checked available tool schemas and bootstrapped the native browser API on the public Supabase migration documentation only; no credential page was opened. The browser API provides clipboard primitives and suppressible observations, but no documented protected credential-transfer transaction or log/reconnect-redaction guarantee. More decisively, its Computer Use Confirmation Policy requires user handoff for changing an authentication credential: “Ask the user to take over before any new credential is entered, and have them complete the entry, confirmation, and submission steps themselves.” This cannot be replaced by approval to let the assistant do the task.

The direct Supabase connector has no key-issuance/secret-transfer capability. No alternative supported non-Composio protected path was verified. Composio credential calls remain prohibited by the task's explicit hold; none were repeated. No credentials were issued or configured. This is a known policy/capability boundary, not an automatic approval denial or an uncertain mutation.

Minimum owner involvement, if proceeding through the browser: the credential-entry and submission portions must be owner-operated, one step at a time with automation disengaged. The assistant can handle code, non-secret configuration preparation, verification and later cutover sequencing once these protected steps and review gates are complete. First navigation only: open the project's Settings → API Keys → Publishable and secret API keys page; do not create, reveal or disable anything yet.

## Independent reviewer finding and cleanup

P0: The imported live-wall-stats source contained a literal WALL_TOKEN. The first scan detected known Supabase/Stripe formats but missed an opaque hex token. The reviewer inadvertently printed the credential line, immediately reported the exposure, and stopped displaying source. No value is repeated in reports.

The draft now reads LIVE_WALL_TOKEN from environment; retained live-wall source copies were sanitized and unpublished draft history rebuilt to exclude the literal. A metadata-only credential-assignment scanner/regression test now covers opaque values, known formats, object properties, environment fallbacks and SQL bearer literals. Snapshot hashes in the inventory document the original retrieval; sanitized source is explicitly marked. The additional live-wall credential rotation is outside current approved scope and remains held; do not deploy this endpoint until that remediation and callers are coordinated.
