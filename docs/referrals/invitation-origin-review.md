# Local invitation origin correction

Prepared after owner approval on2026-11-03T05:43:17UTC. Local only, based on reviewed integration headb9d50142aa98f2de832354d758471aa752790967. No push, deployment, project creation, credential creation or real email.

`referralInvitationOrigin` uses server configuration only. The exact production Supabase URL returns the fixed originhttps://driveshaftcable.com; any staging override in production fails closed. Unknown/unconfigured backends fail. Staging requires both the exact explicitly configured20-letter project ref and the existing approved Render originhttps://dsc-referral-stage-20261103.onrender.com. No wildcard hosts, request Origin/header/data values, credentials, port, path, trailing slash, query or fragment are accepted. Errors do not include supplied values.

Staging configuration names, to be set only after replacement-project/credential approval:

```
REFERRAL_INVITE_STAGING_PROJECT_REF=<exact approved replacement project ref>
REFERRAL_INVITE_ORIGIN=https://dsc-referral-stage-20261103.onrender.com
```

No replacement ref is configured now. The deleted project's credentials are not usable or retained. The ref is a trusted operator-maintained allowlist entry, not caller-selected input; the active SUPABASE_URL must match it exactly. A different frontend hostname requires an explicit code review/change. Production must leave both staging settings unset.

The handler resolves the origin before partner lookup, token generation, invitation mutation or sending. Tokens remain256-bit fragment bearers, SHA256-only in storage; no token is returned in admin responses/logs. Existing synchronous fragment removal and no-referrer behavior are unchanged. Existing email gates and active-admin authorization remain in place.

Validation:337unit tests pass (331existing+6new), including actual endpoint bundling with the real origin helper; production/staging route, caller-origin rejection and zero mutations/token generations/sends on bad configuration. Changed admin Edge entrypoint passes Deno check. git diff --check passes. All sends in new tests are intercepted in memory with dummy credentials and synthetic recipients; no network or real email.

The correction is an uncommitted local diff on the integration worktree. Remote PR27 remains unchanged and draft. No database migration is needed for this correction. Review/publish/deploy and new staging configuration still require the parent's next authorization.
