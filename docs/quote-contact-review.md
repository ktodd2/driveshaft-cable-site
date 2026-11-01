# Quote contact review — local implementation

Base verified from origin/main on 2026-11-01: 141882b4858bf32eaf23536a296ff2156adc6e3a (PR #15).

## Scope

Replaces the quotes table and newest-five-message preview with searchable oldest-first quote cards. Every quote has its full message, current recorded status, exact normalized email order matches (including older, unpaid and cancelled orders, with their statuses), campaign recipient-log events, opt-out evidence and a suggested review action. Timeline entries identify their source. Order links open the existing order detail query route. Existing dashboard quote anchors remain supported.

No automatic conversion, campaign attribution, sends, follow-up enrollment, contact edits, or inbox imports. Last personal contact is explicitly unknown; Gmail/Titan are not synchronized. Suggested next actions are derived review guidance, not saved tasks. No manual notes are introduced. Absence of an opt-out is not consent. Campaign logs mean provider acceptance, not delivery, reply or a personal follow-up. Missing history sources are shown as unavailable, never as zero evidence.

The old quote-status dropdown is removed from this read-only review. It previously attempted updates without reporting failure; inspected live quote_requests policies did not include an authenticated UPDATE policy. Persisted status edits, manual notes, confirmed order links and assigned/due follow-up actions should be a separately reviewed extension with explicit admin-only policies and concurrency controls. Existing quote statuses are preserved and displayed.

## Security and deployment

New read-only Edge Function: `quote-contact-review`. POST requires a validated user JWT and an active matching admin_users row. Anonymous, invalid and non-admin users are rejected before privileged reads. No cron or backend-only bypass. Responses use Cache-Control: no-store. Explicit projections exclude shipping addresses, payment identifiers, campaign HTML and subscriber tokens. Each source is paginated and fails closed independently if any page fails.

Live metadata inspection found existing table policies permit broader authenticated access than active admin membership; orders also has existing anonymous policies. This change neither expands nor repairs those existing policies. It routes all new review access through the active-admin endpoint, rather than relying on those policies. Broader table-policy remediation remains separate work.

No migration and no new table grants required. No production writes were performed. To release, obtain new approval to deploy the new function with JWT gateway verification enabled, then merge/deploy the frontend. Deploy the function first; otherwise the page safely shows Review unavailable. Validate an active admin can read and unauthenticated/non-admin callers cannot before releasing the frontend. Roll back the frontend to restore the prior quotes page; the unused function can then be removed. No data rollback is needed.

## Verification

- 175 Node tests pass (169 existing plus 6 focused tests): exact email matching, duplicate IDs, pre-quote/unpaid orders, no conversion inference, campaign history semantics, opt-outs, missing sources, partial pagination failure, active-admin authorization, no-cache responses and repeat reads.
- Production build passes; existing chunk-size warning and offline sitemap blog-skip remain.
- Route inventory and git diff whitespace checks pass.
- Mocked browser QA passes at 1440×950 and 390×950: timeline/order links, personal-contact unknown labels, opt-out guidance, double refresh deduplication, search, missing-source/error/recovery, empty and stale states, no horizontal overflow or runtime errors. All non-local requests blocked; synthetic records only. Screenshots in quote-review-qa.
- Cached Chromium was incomplete; QA used installed Chrome with a fresh temporary profile, not the user's browser profile.

Re-run browser QA with local Vite at 127.0.0.1:3011 and QUOTE_PLAYWRIGHT_MODULE set to an installed Playwright index.mjs; optionally set QUOTE_BROWSER to a Chrome executable. Run node tests/browser/quoteReview.mjs. Harness is only imported by the test-intercepted HTML route, not the production router.

## Precise next approval

Approve publishing this read-only quote review: deploy `quote-contact-review`, verify its access controls, then merge and deploy the frontend. This approval would not authorize changing customer records, contacting old quotes, inbox synchronization or a database migration.
