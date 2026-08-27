# Newsletter double opt-in — cause and rollout

On 2026-08-27 the Resend dashboard showed welcome-series emails ("One last
thing before we leave you alone", "How volume pricing works…") going out in
bulk to addresses that were clearly not customers — random Gmail accounts,
`mail.ru`, foreign domains — with bounces and suppressions accumulating.

## Cause

The newsletter signup form inserted straight into `newsletter_subscribers`,
and the table's RLS policy allowed **unconditional anonymous inserts**. There
was no CAPTCHA, honeypot, or email verification. Bots stuffed the table with
junk addresses, and the 15-minute welcome-series cron dutifully emailed every
one of them all three stages. None of the addresses corresponded to a paying
customer (the Stripe account was cross-checked), and the list had grown far
beyond the 7 real subscribers that existed in May 2026.

Sending to bot-harvested addresses (some of which are spam traps) damages the
sending reputation of `orders@k-todd.com` and risks the Resend account.

## Fix in this change

| Fix | Where |
| --- | --- |
| Signup goes through an edge function; anonymous table inserts disabled | `newsletter-subscribe/`, migration |
| Confirmation email with single-use tokenized link (double opt-in) | `newsletter-subscribe/`, `newsletter-confirm/` |
| Welcome series only emails `confirmed = true` subscribers | `send-welcome-series/index.ts` |
| Marketing campaigns skip unconfirmed subscribers | `send-marketing-email/index.ts` |
| Honeypot field + per-address resend throttle on signup | `newsletter-subscribe/`, `NewsletterForm.jsx` |
| Every pre-existing unverified subscriber marked `status='purged'` | migration `20260827160000` |
| Confirmation landing page at `/newsletter/confirm` | `NewsletterConfirmPage.jsx` |

Subscriber lifecycle after this change:

```
form submit → status='pending', confirmed=false, confirmation email sent
click link  → status='active', confirmed=true, welcome_stage=0 (series starts)
```

`subscribed_at` is reset at confirmation time so the Day 3 / Day 7 emails are
timed from the confirm click.

The purge marks rows rather than deleting them, so a real person caught in the
purge just re-subscribes through the form and confirms. The rollout script
offers an optional hard delete of purged rows.

## Rollout

Requires credentials this repository does not contain.

```bash
./scripts/deploy-double-opt-in.sh
```

runs everything: shows the list state, applies the migration (`supabase db
push`), deploys `newsletter-subscribe`, `newsletter-confirm`,
`send-welcome-series` and `send-marketing-email`, offers the optional hard
delete, and verifies the final state. Safe to re-run.

The site frontend (new form behavior + `/newsletter/confirm` page) ships with
the normal site deploy — push to `main` as usual.

Deploy order doesn't matter for safety: if the functions deploy before the
migration, their `confirmed = true` filters error against the missing column
and simply send nothing.

## Notes for the admin panel

- Purged and pending subscribers appear in `/admin/newsletter` with their
  status text; only `active` + `confirmed` subscribers receive anything.
- "Reactivate" in the admin panel sets `status='active'` but does **not** set
  `confirmed=true` — a subscriber who never clicked their confirmation link
  stays excluded from all sends. That is intentional; consent comes only from
  the confirmation link.
