# Priority 7 — local release candidate, not published

Base verified through GitHub: `main` = `4f8e0fc82d8893da90d712586a6c2a2c9db0dd5f` (PR #21). Local branch: `feat/admin-review`. No production writes, migration, push, PR, merge or deployment performed.

## Scope

- Suggestions retain their original name, email, message and New/Read/Archived status. Separate review state starts Unreviewed. No historical record is classified, archived, marked read or deleted by this change.
- New inbox includes every New submission except those a human deliberately quarantined. Numeric-only messages are explicitly “needs context,” not spam. Script-like markup and three or more HTTP links produce explainable possible-spam hints. Names, language, short text and duplicate content are not signals. Hints never hide anything or reduce the badge.
- Review hints & quarantine, Quarantine and All submissions views; URL-backed search and detail selection survive reload and back/forward. Quarantine is a two-step, single-record decision. Restore & keep preserves the old status and dismisses hints; Keep does not mark a message Read. Mark New, Mark Read and Archive remain deliberate, reversible actions. No bulk operation or delete button.
- Active-admin-only read, count and decision RPCs. Revision comparison and a trigger covering all row updates prevent stale decisions from overwriting edits, including a status changing away and back. No optimistic writes. Uncertain write results disable further decisions until a fresh read; failed/stale reads retain visibly stale evidence without a valid badge or enabled actions.
- React renders submitted content as plain text, without linkification or HTML execution. Reply links accept an email address only, reject query/header injection, and percent-encode it. No submitted content or customer data is logged by the new code.
- One responsive navigation component on all 11 authenticated admin pages, including Products, Sales, Email & health and View website. Existing dashboard quote and testimonial-page submitted badges are retained with explanatory titles. Suggestion badge is New outside manual quarantine; its count is from the same snapshot on the review page and an active-admin aggregate RPC elsewhere, refreshed on focus, navigation and every 60 seconds. Unavailable counts do not appear as zero. Existing dashboard attention queues and other page controls remain.
- No homepage/public form, inventory plan, shipping fallback, quote review, reporting, newsletter behavior, credentials, scheduled jobs, email functions or sender changes. AdminEmailPage changes only its navigation.

## Read-only production evidence — November 1, 2026

Project `twrihhyfvomqiqbxkitc`:

- Suggestions: **130**, all status **new**. Aggregate-only inspection: all 130 numeric-only, 0 empty, 0 executable-markup signals, 0 messages with at least three `http` tokens. No messages, names or addresses copied to fixtures. These counts do not prove spam. This release initially keeps all 130 in the New inbox.
- Newsletter: **95 active**, **366 purged**, **461 total**; no cleanup or subscription changes.
- Current suggestion schema has id/email/name/message/status/created_at. Its authenticated SELECT/UPDATE/DELETE policies are permissive (`true`). No existing column-specific grants. Candidate replaces browser access with active-admin RPCs; public anonymous submission remains insert-only for email/name/message.
- Tracking cron **job 26 remains inactive**, verified read-only. No schedule was modified.

## Verification

- 212 unit tests pass, including four new classifier/count/filter/safe-link cases and all existing #1–#6 regression tests.
- Isolated PGlite test executes both the original suggestion schema and candidate migration: public insert-only access, anon/non-admin/inactive rejection, active-admin RPC reads and decisions, no direct browser select/update/delete, unchanged content and status on quarantine/restore, duplicate/stale revision rejection, detection of edits by other clients, invalid-action rejection, and list/badge count agreement.
- Local Chrome fixture UI at 1440px and 390px: cancellation, quarantine, restore, double clicks, saved state across reload, status race, disabled actions after failure, hints, malformed records/date, script-looking plain text, unsafe email links, legitimate short/multilingual content, search, rapid filter/search, back/forward/close, error/empty/stale/loading states and no horizontal overflow. All external requests blocked; eight total mocked writes.
- Route-wide fixture renders cover all 31 routes at both widths (62 renders), including all admin destinations. This is rendering/navigation coverage with mocked/empty data, not a full regression of every existing control or production authentication.
- Full build and 31-route inventory pass; `git diff --check` clean. Existing large-chunk warning remains. Offline build skips dynamic blog sitemap lookup because production credentials are intentionally absent.

Browser runner setup: use Vite on `127.0.0.1:3028`; fixture tests intercept the Supabase module and block all other origins. `REPORT_PLAYWRIGHT_MODULE` and `REPORT_BROWSER` can point to a local Playwright installation and Chrome. Database runner accepts `PGLITE_MODULE`. Neither QA path needs production credentials.

## Release approval requested

Approve this reviewed candidate for:

1. Publishing a branch/PR and merging the approved code revision to `ktodd2/driveshaft-cable-site`.
2. Applying only `supabase/migrations/20261101070000_suggestion_review.sql` to project `twrihhyfvomqiqbxkitc`. This adds four review metadata columns, one revision trigger, and three active-admin RPCs (`get_suggestion_review`, `get_suggestion_attention`, `review_suggestion`). It revokes broad browser table access and grants anonymous INSERT only on email/name/message. It does not classify or change any existing message, name, email or workflow status.
3. Publishing the frontend and verifying read-only authenticated views. No edge-function deployment, email test, schedule change, newsletter cleanup or production review decision is included in approval.

Apply schema before publishing the frontend. During that short window the old Suggestions screen cannot read/update directly; tell admins to reload once the new frontend is live. If frontend publication fails, retain the schema and access restrictions, then fix forward with the reviewed RPC-based screen. Do not restore permissive authenticated policies merely to re-enable the obsolete screen. Retain all saved review metadata if rolling back navigation.

No production mutation or production permission test has run. Actual PostgREST deployment and real admin/anonymous read behavior require release verification after approval. No automated historical cleanup is proposed. The reviewer will still need to decide whether numeric-only submissions are junk; the system intentionally does not infer that from names or numbers alone.
