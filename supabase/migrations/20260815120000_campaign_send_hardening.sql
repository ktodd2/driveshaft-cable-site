-- Hardening for marketing campaign sends.
--
-- Fixes the re-send flood: send-marketing-email used to blast the whole list on
-- every invocation and only marked the campaign finished at the very end of a
-- 1-second-per-recipient loop. Any run killed by the edge function execution
-- limit never reached that write, so the campaign stayed "due" forever and the
-- next trigger restarted the blast from the top of the list.
--
-- Two pieces here:
--   1. email_campaign_recipients — per-recipient log, so a resumed run skips
--      addresses that already received the email instead of re-sending.
--   2. claim_campaign_for_send / release_campaign_claim — a lease so overlapping
--      triggers no-op instead of stacking concurrent blasts.

-- ---------------------------------------------------------------------------
-- Per-recipient send log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id BIGSERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  -- Which occurrence of a recurring campaign this send belongs to. One-time
  -- campaigns stay at 1; recurring campaigns bump it each cycle so the same
  -- address can legitimately be mailed again next week.
  cycle INTEGER NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, cycle, email)
);

CREATE INDEX IF NOT EXISTS email_campaign_recipients_lookup_idx
  ON email_campaign_recipients (campaign_id, cycle);

ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Admin panel reads this for per-campaign delivery detail. The edge function
-- writes with the service role, which bypasses RLS.
DO $$ BEGIN
  CREATE POLICY "Allow authenticated read" ON email_campaign_recipients
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Claim/lease columns
-- ---------------------------------------------------------------------------

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS send_cycle INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- claim_campaign_for_send
--
-- Atomically takes the lease on a campaign. Returns a row only if this caller
-- won it. A stale claim (older than p_lease_seconds, i.e. the previous run died)
-- is reclaimable — safe because email_campaign_recipients stops the resumed run
-- from re-mailing anyone.
--
-- p_require_due = true  -> scheduler path; only claims campaigns actually due.
-- p_require_due = false -> admin "Send now"; claims regardless of next_send_at.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_campaign_for_send(
  p_campaign_id INTEGER,
  p_lease_seconds INTEGER DEFAULT 900,
  p_require_due BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id INTEGER,
  subject TEXT,
  html_content TEXT,
  send_type TEXT,
  recurrence TEXT,
  send_cycle INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE email_campaigns c
  SET claimed_at = NOW()
  WHERE c.id = p_campaign_id
    AND c.status NOT IN ('sent', 'cancelled', 'paused')
    AND (NOT p_require_due OR (
      c.is_active IS TRUE
      AND c.next_send_at IS NOT NULL
      AND c.next_send_at <= NOW()
    ))
    -- Unclaimed, or the previous claim's lease has expired.
    AND (c.claimed_at IS NULL OR c.claimed_at < NOW() - make_interval(secs => p_lease_seconds))
  RETURNING c.id, c.subject, c.html_content, c.send_type, c.recurrence, c.send_cycle;
END $$;

REVOKE EXECUTE ON FUNCTION claim_campaign_for_send(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_campaign_for_send(INTEGER, INTEGER, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- release_campaign_claim
--
-- Called once every recipient has been mailed. Recurring campaigns advance to
-- the next occurrence and bump send_cycle (so next cycle mails everyone again);
-- one-time campaigns are marked sent and stop being due.
--
-- p_completed = false just drops the lease without advancing — used when a run
-- exits with recipients still outstanding, so the next run resumes promptly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION release_campaign_claim(
  p_campaign_id INTEGER,
  p_completed BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send_type TEXT;
  v_recurrence TEXT;
  v_next TIMESTAMPTZ;
BEGIN
  IF NOT p_completed THEN
    UPDATE email_campaigns SET claimed_at = NULL WHERE id = p_campaign_id;
    RETURN;
  END IF;

  SELECT send_type, recurrence INTO v_send_type, v_recurrence
  FROM email_campaigns WHERE id = p_campaign_id;

  IF v_send_type = 'recurring' THEN
    v_next := CASE COALESCE(v_recurrence, 'weekly')
      WHEN 'biweekly' THEN NOW() + INTERVAL '14 days'
      WHEN 'monthly'  THEN NOW() + INTERVAL '1 month'
      ELSE                 NOW() + INTERVAL '7 days'
    END;

    UPDATE email_campaigns
    SET last_sent_at = NOW(),
        next_send_at = v_next,
        send_cycle   = send_cycle + 1,
        claimed_at   = NULL,
        updated_at   = NOW()
    WHERE id = p_campaign_id;
  ELSE
    UPDATE email_campaigns
    SET last_sent_at = NOW(),
        next_send_at = NULL,
        status       = 'sent',
        is_active    = false,
        claimed_at   = NULL,
        updated_at   = NOW()
    WHERE id = p_campaign_id;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION release_campaign_claim(INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_campaign_claim(INTEGER, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- Backfill: any campaign left mid-flight by the old code is not left due.
-- ---------------------------------------------------------------------------

UPDATE email_campaigns
SET status       = 'paused',
    is_active    = false,
    next_send_at = NULL,
    claimed_at   = NULL,
    updated_at   = NOW()
WHERE status NOT IN ('sent', 'cancelled', 'draft')
  AND next_send_at IS NOT NULL
  AND next_send_at <= NOW();
