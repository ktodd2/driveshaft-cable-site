# Campaign email flood — cause and runbook

On 2026-08-15 the campaign `Your exclusive 10% loyalty discount — K.Todd Driveshaft`
was delivered to the full customer list every 15 minutes (09:16, 09:31, 09:46,
10:01, 10:16, 10:31 …).

## Cause

Two independent problems combined.

**1. An untracked cron job.** The admin panel could create `scheduled` and
`recurring` campaigns with a `next_send_at`, but nothing in this repository ever
polled for them. Whatever fired them was a `pg_cron` entry created directly in
the production database — on a `*/15 * * * *` schedule, invisible to code review.

**2. `send-marketing-email` treated every call as a fresh full blast.** It had:

- no authorization check at all — anyone who knew the URL could mail every customer;
- no check of campaign `status`, `is_active`, or whether `next_send_at` was due —
  it sent unconditionally whenever it was invoked;
- no record of who had already received the email;
- the "this campaign is finished" write (`status = 'sent'`, `next_send_at = NULL`)
  placed at the *end* of a loop that slept **1 second per recipient**.

That last point is what made it repeat forever. A list of a few hundred addresses
takes longer than the edge function execution limit, so the run was killed before
it ever reached the completion write. The campaign stayed permanently "due," and
the next tick restarted the blast from the top of the list.

## Fixes in this change

| Fix | Where |
| --- | --- |
| Auth guard (service role / cron key / signed-in admin) | `send-marketing-email/index.ts` |
| Lease-based claim so overlapping triggers no-op | `claim_campaign_for_send()` |
| Per-recipient log so a resumed run never re-mails anyone | `email_campaign_recipients` |
| Completion write only when the list is actually drained | `release_campaign_claim()` |
| Batch sending (100/request) so runs finish | `send-marketing-email/index.ts` |
| Paginated recipient queries (previously capped at 1000 rows) | `send-marketing-email/index.ts` |
| Dispatcher in version control, hourly instead of every 15 min | `dispatch-campaigns/`, `setup-cron-jobs/` |

The migration also defensively pauses any campaign left mid-flight by the old code.

---

## Runbook

Requires credentials this repository does not contain.

### The whole thing, scripted

`scripts/fix-email-flood.sh` runs every step below in order, showing what it's
about to change and asking before each destructive action:

```bash
./scripts/fix-email-flood.sh
```

Safe to re-run. The manual sequence follows, if you'd rather do it step by step.

```bash
supabase login                                   # or export SUPABASE_ACCESS_TOKEN=...
supabase link --project-ref twrihhyfvomqiqbxkitc
```

### Step 1 — Stop the sending (do this first)

Find the rogue job:

```bash
supabase db query --linked \
  "SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobid;"
```

Look for any job whose `command` references `send-marketing-email`, or any job on
a `*/15` schedule that is not `send-welcome-series-15min`. Unschedule it:

```bash
supabase db query --linked "SELECT cron.unschedule('<jobname-from-above>');"
```

Then take the campaign itself out of the due state:

```bash
supabase db query --linked \
  "UPDATE email_campaigns
      SET status = 'cancelled', is_active = false, next_send_at = NULL
    WHERE subject ILIKE '%loyalty discount%'
   RETURNING id, subject, status;"
```

Sending stops here. Everything below is the durable fix.

### Step 2 — Confirm the diagnosis (optional)

```bash
supabase db query --linked \
  "SELECT jobname, status, start_time, end_time
     FROM cron.job_run_details
    ORDER BY start_time DESC LIMIT 20;"
```

Runs that never reached the completion write show up as failed or long-running.

### Step 3 — Apply the migration

```bash
supabase db push
```

### Step 4 — Deploy the functions

```bash
supabase functions deploy send-marketing-email
supabase functions deploy dispatch-campaigns
supabase functions deploy setup-cron-jobs
```

### Step 5 — Register the hourly dispatcher

`CRON_TRIGGER_KEY` must already be set (`supabase secrets list`). If not:

```bash
supabase secrets set CRON_TRIGGER_KEY="$(openssl rand -hex 32)"
```

Then run the setup function once:

```bash
supabase functions invoke setup-cron-jobs
```

Verify only the expected jobs exist — and that nothing points at
`send-marketing-email` on a short schedule:

```bash
supabase db query --linked \
  "SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;"
```

Expected: `send-abandoned-cart-hourly`, `send-welcome-series-15min`,
`send-reorder-reminder-daily`, `send-winback-weekly`,
`send-dispatch-campaigns-hourly`, `check-tracking-twice-daily`,
`process-testimonial-queue-daily`.

### Step 6 — Re-send safely, if you still want that campaign to go out

Because `email_campaign_recipients` records the earlier flood, resuming the
existing campaign row would skip everyone who already received it. To mail only
the people who never got it, reuse the original campaign id:

```bash
supabase db query --linked \
  "UPDATE email_campaigns
      SET status = 'active', is_active = true, next_send_at = NOW(), claimed_at = NULL
    WHERE id = <campaign-id>;"
```

The dispatcher picks it up within the hour and mails only the outstanding
addresses. To deliberately mail everyone again, bump `send_cycle` first.

## Guardrail

Do not create `pg_cron` jobs by hand. Add them to `CRON_JOBS` in
`supabase/functions/setup-cron-jobs/index.ts` and re-invoke that function, so the
schedule is reviewable in git. `list_email_cron_jobs()` only surfaces jobs named
`send-%`, which is why the rogue job was easy to miss — prefer that prefix.
