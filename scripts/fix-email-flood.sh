#!/usr/bin/env bash
#
# Stops the repeating marketing-campaign blast and applies the durable fix.
#
# Run from the repo root on a machine where you're logged into the Supabase CLI:
#
#     ./scripts/fix-email-flood.sh
#
# Every destructive step asks first and shows you what it's about to touch.
# Safe to re-run: the migration is idempotent and re-registering cron jobs
# unschedules the old entry before recreating it.

set -euo pipefail

PROJECT_REF="twrihhyfvomqiqbxkitc"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
warn()  { printf '\033[33m%s\033[0m\n' "$*"; }
fail()  { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
ok()    { printf '\033[32m%s\033[0m\n' "$*"; }
rule()  { printf '\n\033[2m%s\033[0m\n' "────────────────────────────────────────────────────────"; }

confirm() {
  local prompt="$1"
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

q() { supabase db query --linked "$1"; }

# ---------------------------------------------------------------------------
# 0. Preflight
# ---------------------------------------------------------------------------
rule; bold "0. Preflight"

command -v supabase >/dev/null 2>&1 || fail "supabase CLI not found. Install: npm i -g supabase"
[[ -d supabase/migrations ]] || fail "Run this from the repo root (no supabase/migrations here)."

if ! supabase projects list >/dev/null 2>&1; then
  warn "Not logged in. Opening the login flow..."
  supabase login
fi

supabase link --project-ref "$PROJECT_REF" >/dev/null 2>&1 || true
ok "Linked to $PROJECT_REF"

# ---------------------------------------------------------------------------
# 1. Show what's scheduled
# ---------------------------------------------------------------------------
rule; bold "1. Currently scheduled cron jobs"
q "SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;"

bold "Jobs that fire the marketing sender:"
q "SELECT jobid, jobname, schedule FROM cron.job WHERE command ILIKE '%send-marketing-email%';"

# ---------------------------------------------------------------------------
# 2. Stop the sending
# ---------------------------------------------------------------------------
rule; bold "2. Unschedule the rogue job(s)"

if confirm "Unschedule every cron job that calls send-marketing-email?"; then
  q "DO \$\$
     DECLARE j RECORD;
     BEGIN
       FOR j IN SELECT jobname FROM cron.job
                WHERE command ILIKE '%send-marketing-email%'
       LOOP
         PERFORM cron.unschedule(j.jobname);
         RAISE NOTICE 'unscheduled: %', j.jobname;
       END LOOP;
     END \$\$;"
  ok "Unscheduled."
else
  warn "Skipped — the flood continues until this is done."
fi

# ---------------------------------------------------------------------------
# 3. Take the campaign out of the due state
# ---------------------------------------------------------------------------
rule; bold "3. Cancel the loyalty-discount campaign"

bold "Campaigns that would be affected:"
q "SELECT id, subject, status, is_active, next_send_at
     FROM email_campaigns
    WHERE subject ILIKE '%loyalty discount%';"

if confirm "Mark those cancelled and clear next_send_at?"; then
  q "UPDATE email_campaigns
        SET status = 'cancelled', is_active = false, next_send_at = NULL
      WHERE subject ILIKE '%loyalty discount%'
    RETURNING id, subject, status;"
  ok "Campaign cancelled. Sending has stopped."
else
  warn "Skipped."
fi

# ---------------------------------------------------------------------------
# 4. Apply the migration
# ---------------------------------------------------------------------------
rule; bold "4. Apply the hardening migration"

if confirm "Run 'supabase db push'?"; then
  supabase db push
  ok "Migration applied."
else
  warn "Skipped — steps 5 and 6 depend on this."
fi

# ---------------------------------------------------------------------------
# 5. Deploy the edge functions
# ---------------------------------------------------------------------------
rule; bold "5. Deploy the functions"
warn "Until send-marketing-email is redeployed it still has NO auth check."

if confirm "Deploy send-marketing-email, dispatch-campaigns and setup-cron-jobs?"; then
  supabase functions deploy send-marketing-email
  supabase functions deploy dispatch-campaigns
  supabase functions deploy setup-cron-jobs
  ok "Functions deployed."
else
  warn "Skipped — do not run step 6 without this."
fi

# ---------------------------------------------------------------------------
# 6. Re-register the cron jobs (hourly dispatcher included)
# ---------------------------------------------------------------------------
rule; bold "6. Register cron jobs"
echo "Reads CRON_TRIGGER_KEY from the function secrets, so no key is handled here."

if confirm "Invoke setup-cron-jobs to (re)register all email cron jobs?"; then
  supabase functions invoke setup-cron-jobs
  ok "Cron jobs registered."
else
  warn "Skipped."
fi

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
rule; bold "7. Final state"

bold "Cron jobs:"
q "SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;"

bold "Anything still pointed at the marketing sender (should be empty):"
q "SELECT jobname, schedule FROM cron.job WHERE command ILIKE '%send-marketing-email%';"

bold "Campaigns still due (should be empty):"
q "SELECT id, subject, status, next_send_at
     FROM email_campaigns
    WHERE is_active IS TRUE AND next_send_at IS NOT NULL AND next_send_at <= NOW();"

rule
ok "Done."
echo "Expected cron jobs: send-abandoned-cart-hourly, send-welcome-series-15min,"
echo "send-reorder-reminder-daily, send-winback-weekly, send-dispatch-campaigns-hourly,"
echo "check-tracking-twice-daily, process-testimonial-queue-daily."
