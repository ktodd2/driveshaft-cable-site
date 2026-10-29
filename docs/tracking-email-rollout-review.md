# Versioned tracking-email rollout review — 2026-10-29

Prepared locally at parent direction after deployment approval; publication explicitly authorized by the owner on 2026-10-29 at 20:58 UTC after independent review. Deployment results will be recorded separately; no order mutations or real email tests are authorized.

## Final local changes

- Strict handler moved to `supabase/functions/send-tracking-email-v2/index.ts`.
- Legacy `supabase/functions/send-tracking-email/index.ts` restored byte-for-byte to base `035187de18c3c64c376a6f2605231a8b59d8fc79`; verified with `git diff --exit-code HEAD -- supabase/functions/send-tracking-email/index.ts`.
- Refreshed frontend invokes only `send-tracking-email-v2`. Unit and browser mocks assert that exact name. Existing authorization rejection tests now cover both endpoints.
- No legacy compatibility adapter, generated fallback identity, endpoint retirement or durable ledger added.

## Exact deployment plan (not executed)

1. Finish independent review of the regenerated patch. Preserve the legacy endpoint, sender, shared authorization/key helpers and all unrelated changes.
2. Publish reviewed source through the approved repository process. Deploy ONLY the new function named `send-tracking-email-v2`, bundling its `_shared` dependencies. Use the same project and gateway authentication policy as the existing tracking function (live legacy v25 was read back before release with `verify_jwt: false`; v2 must match this and retain its explicit guard). Do not change legacy gateway settings or secrets. The function's explicit `authorizeStoreRequest(req, createClient)` remains mandatory, regardless of gateway policy.
3. Verify the new deployment artifact, version/name and configuration read-only. If an HTTP auth probe is desired, use an unauthorized request with no customer/shipment payload; it must fail before database/email work. Do not make an authorized real-message smoke test without separate authorization.
4. Only after v2 is deployed and verified, deploy the matching frontend that invokes `send-tracking-email-v2`. Never ship this frontend pointing to the legacy endpoint, and never fall back to legacy after a v2 failure.
5. Tell the owner: “Refresh the admin page before entering tracking to use the new Save & Email status and safe retry controls. Already-open tabs keep the old behavior.” Confirm the refreshed frontend release/build without sending mail. Do not replay old ambiguous notifications automatically.
6. Leave `send-tracking-email` unchanged and available. No retirement is part of this release.

## Transition, limitations and rollback

Function-first staging is safe because existing clients continue using the untouched legacy function; no old client starts receiving new required-field errors. Refreshed clients use v2 after its deployment. Old open tabs keep their prior failure visibility and duplicate-send limitations. No new retry guarantee is claimed for them or for mixed old/new concurrent editing of the same order. Ask the owner to stop using old tabs and refresh before tracking entry; another client editing the order can invalidate a v2 retry.

V2 state is in-memory for the mounted page session. Reload loses notification identity/status. Saving unchanged tracking after reload does not resend. Review ambiguous pre-release sends manually; never rewrite tracking merely to force another notification. No durable outbox or direct-database-edit delivery coverage.

If frontend publication fails, leave v2 staged and legacy untouched. If rollback is necessary after use, keep v2 deployed for open new-client tabs and their in-flight/23-hour retries. Rolling the frontend back restores legacy behavior for refreshed sessions; communicate the loss of new guarantees. Never reroute pending v2 notifications to the legacy sender, invent replacement identities, or automatically resend during rollback. If v2 itself must be disabled, fail closed and require review rather than silently falling back.

## Final local verification

New run: focused workflow/auth 33/33, full unit suite 152/152, production build passed, route inventory passed for 31 routes, diff check passed. Mocked Chromium desktop/mobile rerun against v2; see `/tmp/tracking-v2-browser.log`. Legacy unchanged check passed. Build has the existing bundle-size warning and skips blog sitemap fetching without credentials.

## Busy and retry verification

Newly ran `node /tmp/tracking-busy-review.mjs` (isolated mocks, no network): 16/16 scenarios passed. Scenarios: success, unchanged save, missing email, initial-read error, save error, readback error, pre-send read error, network exception, malformed success, HTTP 409, retry success, retry network exception, retry read failure, changed recipient, expiry, future timestamp. Asserted terminal busy is false/absent after each settled operation; retry remains enabled only for retryable ambiguous/read-failure cases. New run of `node --test tests/unit/trackingNotification.test.mjs`: 24/24 passed.

Code reasoning: save publishes busy:true but passes a separate state without busy into send; send terminal states therefore clear busy by omission. Retry passes busy:false to send. Save and retry both remove the synchronous lock in finally. No stuck-busy defect found on ordinary settled paths. Existing tests mainly assert sends/identity and retry flag, not every terminal busy state; the additional external review harness supplies those assertions without changing implementation/tests.

Limits: no workflow-level timeout, so a never-settling database/invoke promise leaves busy true until it settles or the page reloads. onState/onSaved are assumed to be nonthrowing React setters. An expired retry can remain visibly enabled until clicked; clicking checks time and disables it without sending. Unchanged save may restore a previous retry state without validating it immediately; actual retry re-reads and verifies the snapshot before any send. Page refresh/unmount loses all notification state; unchanged tracking afterward sends nothing. Changed customer name/email or any updated_at revision blocks retry conservatively.
