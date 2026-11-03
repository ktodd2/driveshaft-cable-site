# Buyer email verification — local review

Owner selected email verification before first-order reservation. This work is local and unpublished on integration head `b9d50142aa98f2de832354d758471aa752790967`. No production deployment, hosted migration, new provider credential or actual email send occurred.

## Buyer flow and security boundary

1. A new buyer supplies their email, completes a bot challenge and explicitly requests a link. Requests create no checkout claim. The response contains neither link, token, proof nor status-polling identifier.
2. The email contains a one-hour private link. Its fragment is stripped before analytics; private verification and signup routes independently suppress analytics even if the external scrubber fails. Opening the page consumes nothing.
3. The receiver presses **Verify email**. That browser independently generates a 256-bit proof and submits an explicit POST with the link. The database stores hashes only, consumes atomically, and returns only email/expiry. An identical receiver retry can recover a lost response without extending expiry. A different proof cannot reuse the link.
4. The receiver’s tab retains the proof in session storage with memory fallback. Matching checkout tabs in the same browser may receive it through same-origin BroadcastChannel. An unrelated browser that requested the message receives nothing. A cross-device receiver continues checkout in its own browser and may need to rebuild its cart.
5. A new first-order reservation must possess a matching unexpired proof under the email lock. This applies to uncoded first checkouts too, preventing anonymous callers from holding another person’s email through that path. Repeat paid/refunded customers retain existing eligibility. Already-prepared private capabilities remain recoverable after proof expiry; a proof never replaces that capability.

Ordinary continuation uses a full navigation once the proof is persisted, restoring normal checkout analytics. If session storage is blocked, the page warns the buyer to keep the tab open and uses SPA navigation so the memory-only proof survives. React StrictMode and missing scrubber asset are covered by the browser fixture.

## Anti-abuse and isolation

Cloudflare Turnstile is checked server-side for the fixed hostname, action, request UUID and timestamp, with a ten-second timeout. No forwarded IP header is trusted. Official dummy keys are accepted only for exact replacement project `dmpvmztdkfdkilygxiaj` and the approved staging host, with an explicit test flag. Production rejects dummy keys and test-recipient settings. No Cloudflare account/widget or secret was created.

The database globally serializes send budgets: one-minute email cooldown, three per email/hour, 25 global/hour, 100/day and 1,000/UTC month. All requests, including uncertain deliveries, consume the budget. Limits return the same generic response; resends never invalidate older links. This bounds abuse but does not guarantee availability against coordinated challenge-solving attacks. Raising these conservative limits requires capacity review. No automatic account creation, password, public referral enrollment or privilege expansion is added.

Existing email-attempt claims and provider dedupe are reused. Unknown outcomes are held for review, not blindly resent. Stage delivery accepts synthetic fixture identities only. Real staging delivery additionally requires **one exact approved owner recipient, message revision `buyer-verification-v1`, and request UUID**; only `buyer@referral-final.invalid` can route there. The UUID is durable and one-shot. Intercepted transport is dependency-injected server-side, requires exact staging and a non-provider transport, and is labeled `intercepted` separately from actual delivery. A client cannot enable it.

The additive migration `20261103145323_buyer_email_verification.sql` adds private RLS tables and service-only functions. Browser roles cannot read, forge or consume database proofs directly. Raw link/proof values are absent from payment parameters, fingerprints, public order responses and committed fixtures. New delivery flags default false. No protected order-access cutover is included.

## Evidence

- **348 unit tests** and **six composed verification/database integrations** pass; independent review reproduced these and all five SQL send-budget boundaries, eight transport-isolation rejection cases, and approved-recipient one-shot dedupe.
- Real PostgreSQL 17.6 independent sessions prove overlapping consumes, same-pair retries, proof/link expiry after lock waits and serialized budget contention. See `concurrency-v2-local.json`. Provider, signature, challenge and email transport remain simulated.
- Local headless browser fixture covers explicit confirmation, separate-requester isolation, native same-browser handoff, receiver continuation, uncoded checkout protection, fragment asset failure and blocked session storage. External traffic is blocked. Screenshots: `screenshots/email-confirm-390.png` and `screenshots/email-verified-1440.png`.
- Verification endpoint and both checkout creation routes plus quote type-check. Route inventory includes the private utility page and excludes it from indexing. The Vite bundle builds using loopback/fixture configuration in a temporary directory; it is not a deployable artifact.

## Remaining hosted/release gates

The hosted site still serves the old integration head and does not validate this work. Prepare an exact reviewed publication/deployment source and update the staging commit guard; do not bypass it with an unreviewed inline source patch. Verify the private staging adapter allows only the new synthetic verification metadata/financial snapshots before additive staging migrations and endpoint deployments. Collect actual hosted gateway, browser, signed Stripe Test webhook/payment/refund and tax evidence under the new rules before any access-policy retry.

Production needs approved Turnstile widget/key configuration and secure mail configuration. No new key or setting is implicitly approved by this document. Real owner-only test delivery still needs a selected recipient and the exact third-message draft in `staging/OWNER-EMAIL-APPROVAL-DRAFTS.md`; intercepted delivery proves no mailbox receipt. The earlier test-login password buffers are unavailable after runtime reset, so authenticated hosted tests need a proper sign-in/recovery handoff rather than credential fabrication.

Existing pre-verification first-order claims are grandfathered solely through their original private capabilities. Review any such production claims and unknown payable history before activation; do not claim that migration retroactively proves ownership.

Staging remains limited to **$1 total / 24 hours**, hard deadline **November 4, 2026, 05:42:19 UTC**. Separate action-time deletion approval is required; do not keep the project running for a pending release decision. Rollback disables new offers/delivery while preserving proof/capability recovery, frozen paid terms, reconciliation and liabilities. Never release a still-payable checkout or restore broad anonymous order access.

## Later hosted checkpoint

The reviewed additive migrations and ten synthetic-only staging endpoints are now deployed with exact source readback. Current API tests and their limits are recorded in `staging/replacement/V2-HOSTED-CHECKPOINT.md`. The actual Cloudflare dummy response required a small, independently reviewed exact-stage-only compatibility correction; production rejects that profile. The remote frontend is still the old draft head, so no owner email has been sent. All test feature/send flags are off again.
