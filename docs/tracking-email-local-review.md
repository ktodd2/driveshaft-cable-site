# Tracking email reliability — local review, 2026-10-29

Base: `035187de18c3c64c376a6f2605231a8b59d8fc79`, also returned by `git ls-remote origin refs/heads/main` during this task. Working branch: `work`. No commit, push, PR, merge, deployment, production mutation, or real email send performed.

Changes:
- `src/lib/trackingNotification.js`: session-local per-order workflow, synchronous busy guard, authoritative reads, conditional update with returned single row and a separate readback, exact shipment/recipient verification, unchanged-save no-op, preserved delivered status, separate save/email outcomes, retry without writing an order.
- `src/pages/admin/AdminOrdersPage.jsx`: persistent per-order status, retry button, explicit edit/cancel state, draft resets on order selection, functional state updates to avoid asynchronous cross-order contamination.
- `supabase/functions/send-tracking-email-v2/index.ts`: new versioned endpoint; retains pinned client, existing authorization guard, modern key/transport helpers and `orders@driveshaftcable.com`; verifies saved row and notification age/version, sends deterministic Resend key, rejects success without a nonempty provider ID.
- Legacy `supabase/functions/send-tracking-email/index.ts` is byte-for-byte unchanged from base. Frontend and mocks exclusively target `send-tracking-email-v2`.
- `tests/unit/trackingNotification.test.mjs`: 24 new isolated tests. Function VM tests explicitly supply mocks for the current auth/client/key/transport imports; the auth guard is executed, not removed. Existing authorization tests also rerun.
- `tests/browser/trackingNotification.mjs` and `trackingHarness.jsx`: actual admin page in Chromium, fake Supabase module, external requests blocked. Desktop 1440×1000 and mobile 390×844 exercise failed email, retained tracking/status, retry-only, identical identity, double-click protection, cancellation and order switching.

Identity and limits:
- Each changed save creates a UUID and timestamp. A→B→A receives three identities. Same-save retries retain identical body/key, including network/lost-response outcomes. Resend is responsible for deduplicating identical concurrent HTTP sends; tests verify key/body reuse, not live provider behavior.
- Retry cutoff is 23 hours from notification creation, below Resend's documented 24-hour retention. Both client and function enforce it. Future timestamps, changed template version, changed saved revision, tracking or recipient fail closed. HTTP 409 becomes review-required in the page. Bump the explicit template version whenever changing sender or rendered payload semantics.
- Status and retry identity live only in the mounted page session. This is not a durable outbox; it does not survive page reload/browser closure or send emails for direct database edits. Unchanged tracking after reopening never silently resends. Review is required when identity is lost, save outcome is uncertain, or retry expires.
- Any `updated_at` change (including unrelated order/cron work) conservatively invalidates a retry. Missing email preserves tracking but requires review. Provider acceptance is not delivery. Database read/send is not one atomic transaction; concurrent external edits after verification are outside this narrow guarantee.
- A failed/ambiguous save cannot be used as permission to send; inspect the order before further action. No schema, auth policy, settings or secret changes.

Newly run verification (no historical results represented as new):

```
npm ci --ignore-scripts --cache /tmp/tracking-npm-cache
node --test tests/unit/trackingNotification.test.mjs tests/unit/storeAuthorization.test.mjs
npm test
npm run build
npm run routes:check
git diff --check
```

Results: dependency install succeeded; focused workflow/auth 33/33; full 152/152; build passed; inventory passed for 31 routes; diff check passed. Build retains the large-bundle warning and skips blog sitemap data without Supabase credentials. Initial `npm ci --ignore-scripts` failed because `/home/agent/.npm` was unwritable; the first full/build attempts consequently failed due to missing dependencies. Those were rerun successfully after using `/tmp` cache.

Browser commands:

```
npm install --prefix /tmp/tracking-browser playwright --cache /tmp/tracking-npm-cache --ignore-scripts
VITE_SUPABASE_URL=https://offline.invalid VITE_SUPABASE_PUBLISHABLE_KEY=offline npm run dev -- --host 127.0.0.1
TRACKING_PLAYWRIGHT_MODULE=/tmp/tracking-browser/node_modules/playwright/index.mjs node tests/browser/trackingNotification.mjs
```

Both viewports passed. Screenshots `/tmp/tracking-1440.png`, `/tmp/tracking-390.png`; mobile screenshot inspected. Logs: `/tmp/tracking-v2-{focused,full,build,routes,browser}.log`. Initial browser harness failures (wrong port, mock syntax, module duplication, assertion timing) were corrected; final test passes. No production endpoints were used.

Guidance and sources:
- `.agents` was empty; no AGENTS.md found. CLAUDE.md auto-push preference is overridden by explicit local-only authorization.
- Resend current docs read: https://resend.com/docs/dashboard/emails/idempotency-keys (24-hour retention, stable identical requests, Idempotency-Key header).
- Supabase update/single docs read: https://supabase.com/docs/reference/javascript/update and https://supabase.com/docs/reference/javascript/single . Changelog fetch was unavailable (web markdown unsupported, direct HTTP 403); no client version/API migration was attempted.

Publication was subsequently authorized on 2026-10-29 at 20:58 UTC; the following is the reviewed staged release plan. Deploy the new `send-tracking-email-v2` function first, preserving the existing guard and gateway policy; deploy the matching frontend second. Never replace or retire the legacy endpoint in this rollout. Old open tabs retain legacy behavior and do not gain retry guarantees; tell the owner to refresh before entering tracking. There is no automatic fallback to the legacy endpoint. See `tracking-email-rollout-review.md` for the exact deployment sequence, verification and rollback limits. No remaining local implementation/test blocker and no automatic approval denial occurred.
