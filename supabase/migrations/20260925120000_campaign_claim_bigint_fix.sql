-- Fix: claim_campaign_for_send always failed with 42804.
--
-- The hardening migration declared the claim/release functions against
-- `id INTEGER`, but email_campaigns.id in this project is BIGINT (the table
-- predates the repo migration file and was created with a bigint identity
-- column). PL/pgSQL checks RETURNS TABLE column types strictly, so every call
-- aborted with:
--
--   ERROR: 42804: structure of query does not match function result type
--   DETAIL: Returned type bigint does not match expected type integer in column 1.
--
-- That made *every* send fail: the admin "Send now" button and the hourly
-- dispatcher both claim before sending, so nothing could ever go out.
--
-- Drops the integer-signature functions rather than leaving them alongside the
-- bigint ones — PostgREST resolves RPCs by argument name, so two overloads
-- differing only by numeric width make `rpc('claim_campaign_for_send', ...)`
-- ambiguous.
--
-- Also widens email_campaign_recipients.campaign_id to match the bigint PK it
-- references. The FK worked via implicit cast, but the types should agree.

DROP FUNCTION IF EXISTS claim_campaign_for_send(INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS release_campaign_claim(INTEGER, BOOLEAN);

ALTER TABLE email_campaign_recipients
  ALTER COLUMN campaign_id TYPE BIGINT;

-- ---------------------------------------------------------------------------
-- claim_campaign_for_send (bigint)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_campaign_for_send(
  p_campaign_id BIGINT,
  p_lease_seconds INTEGER DEFAULT 900,
  p_require_due BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id BIGINT,
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

REVOKE EXECUTE ON FUNCTION claim_campaign_for_send(BIGINT, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_campaign_for_send(BIGINT, INTEGER, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- release_campaign_claim (bigint)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION release_campaign_claim(
  p_campaign_id BIGINT,
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

REVOKE EXECUTE ON FUNCTION release_campaign_claim(BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_campaign_claim(BIGINT, BOOLEAN) TO service_role;
