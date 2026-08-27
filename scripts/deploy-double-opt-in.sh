#!/usr/bin/env bash
#
# Rolls out newsletter double opt-in and purges the bot-filled subscriber list.
#
# Run from the repo root on a machine where you're logged into the Supabase CLI:
#
#     ./scripts/deploy-double-opt-in.sh
#
# What it does, in order:
#   1. shows the current subscriber list state
#   2. applies the migration (adds confirmed/token columns, marks every
#      pre-existing unverified subscriber as status='purged', and removes the
#      anonymous-insert policy bots were using)
#   3. deploys the new/updated edge functions
#   4. optionally hard-deletes the purged rows
#
# Safe to re-run: the migration is idempotent and already-purged rows are
# untouched. The site frontend (new signup form + /newsletter/confirm page)
# ships with the normal site deploy — push to main as usual.

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
# 1. Current list state
# ---------------------------------------------------------------------------
rule; bold "1. Subscriber list before the change"
q "SELECT status, COUNT(*) FROM newsletter_subscribers GROUP BY status ORDER BY status;"

# ---------------------------------------------------------------------------
# 2. Apply the migration (adds columns + purges unverified subscribers)
# ---------------------------------------------------------------------------
rule; bold "2. Apply the double-opt-in migration"
echo "This marks every existing unverified subscriber as status='purged' so no"
echo "automation emails them again, and disables direct anonymous inserts."

if confirm "Run 'supabase db push'?"; then
  supabase db push
  ok "Migration applied. The welcome series has nothing left to send to."
else
  warn "Skipped — the junk list keeps receiving welcome emails until this runs."
fi

# ---------------------------------------------------------------------------
# 3. Deploy the edge functions
# ---------------------------------------------------------------------------
rule; bold "3. Deploy the functions"
echo "  newsletter-subscribe  (new) — signup endpoint, sends the confirmation email"
echo "  newsletter-confirm    (new) — activates a subscriber from the emailed link"
echo "  send-welcome-series        — now only emails confirmed subscribers"
echo "  send-marketing-email       — campaigns now skip unconfirmed subscribers"

if confirm "Deploy these four functions?"; then
  supabase functions deploy newsletter-subscribe
  supabase functions deploy newsletter-confirm
  supabase functions deploy send-welcome-series
  supabase functions deploy send-marketing-email
  ok "Functions deployed."
else
  warn "Skipped — the old form insert path is dead once the frontend deploys,"
  warn "so signups will not work until these functions exist."
fi

# ---------------------------------------------------------------------------
# 4. Optionally hard-delete the purged junk rows
# ---------------------------------------------------------------------------
rule; bold "4. Hard-delete purged rows (optional)"
q "SELECT COUNT(*) AS purged_rows FROM newsletter_subscribers WHERE status = 'purged';"
echo "Keeping them costs nothing and preserves history; deleting them cannot be undone."

if confirm "Permanently DELETE all rows with status='purged'?"; then
  q "DELETE FROM newsletter_subscribers WHERE status = 'purged';"
  ok "Purged rows deleted."
else
  ok "Kept purged rows (they will never be emailed either way)."
fi

# ---------------------------------------------------------------------------
# 5. Verify
# ---------------------------------------------------------------------------
rule; bold "5. Final state"

bold "Subscribers by status/confirmed:"
q "SELECT status, confirmed, COUNT(*)
     FROM newsletter_subscribers
    GROUP BY status, confirmed
    ORDER BY status, confirmed;"

bold "Anonymous-insert policy (should return 0 rows):"
q "SELECT policyname FROM pg_policies
    WHERE tablename = 'newsletter_subscribers' AND 'anon' = ANY(roles);"

rule
ok "Done."
echo "Remember: the new signup form and /newsletter/confirm page are in the site"
echo "frontend — deploy the site (push to main) to complete the rollout."
