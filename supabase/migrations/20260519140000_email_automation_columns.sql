-- Email automation infrastructure: columns + cart abandonment table.
--
-- Powers four automated email workflows:
--   1. Abandoned cart recovery   (uses cart_abandonments table)
--   2. Welcome series            (uses newsletter_subscribers.welcome_stage)
--   3. Day-30 reorder reminder   (uses orders.reorder_reminder_sent_at)
--   4. Win-back campaign         (uses orders.winback_email_sent_at)
--
-- Idempotent and safe to re-run.

-- Welcome series stage advances 0 -> 1 -> 2 -> 3 across Day 0, Day 3, Day 7.
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS welcome_stage INTEGER NOT NULL DEFAULT 0;

-- Reorder reminder is sent exactly once per paid order, 30 days after delivery.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reorder_reminder_sent_at TIMESTAMPTZ;

-- Win-back is sent at most once per 6-month window per customer email.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS winback_email_sent_at TIMESTAMPTZ;

-- Cart abandonments are written from CheckoutPage when an email is entered
-- but the customer never reaches the payment step. The hourly cron picks up
-- rows older than 1 hour, sends the recovery email, and stamps email_sent_at.
CREATE TABLE IF NOT EXISTS cart_abandonments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  items JSONB NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  recovery_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent_at TIMESTAMPTZ,
  recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL
);

-- Partial index: only the "needs-to-be-emailed" rows are queried by the cron,
-- so this is the only one worth indexing.
CREATE INDEX IF NOT EXISTS idx_cart_abandonments_pending
  ON cart_abandonments (created_at)
  WHERE email_sent_at IS NULL;

-- RLS: only the service role (used by edge functions) touches these tables,
-- so we lock down anonymous access. CheckoutPage writes via an edge function
-- (or via authenticated anon role with an explicit INSERT policy), not direct.
ALTER TABLE cart_abandonments ENABLE ROW LEVEL SECURITY;

-- Allow anon role to INSERT abandonments (CheckoutPage runs client-side with
-- anon key). Reads and updates are service-role only.
DO $$ BEGIN
  CREATE POLICY cart_abandonments_anon_insert ON cart_abandonments
    FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The recovery route needs to read a single row by token. Use a security-
-- definer function instead of opening up SELECT to anon.
CREATE OR REPLACE FUNCTION get_cart_abandonment_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  items JSONB,
  subtotal_cents INTEGER,
  recovered_order_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, items, subtotal_cents, recovered_order_id
  FROM cart_abandonments
  WHERE recovery_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_cart_abandonment_by_token(TEXT) TO anon;

-- Aggregate stats for the admin "Email Automation Status" panel. Single RPC
-- so the panel makes one round trip. Includes recovered-cart revenue via a
-- join: any paid order from the same email placed AFTER the abandonment
-- email_sent_at counts as recovered.
CREATE OR REPLACE FUNCTION get_email_automation_stats()
RETURNS TABLE (
  abandoned_cart_sent_7d INTEGER,
  reorder_sent_7d INTEGER,
  winback_sent_7d INTEGER,
  welcome_started_total INTEGER,
  welcome_completed_total INTEGER,
  abandoned_cart_last_run TIMESTAMPTZ,
  reorder_last_run TIMESTAMPTZ,
  winback_last_run TIMESTAMPTZ,
  recovered_cart_revenue_cents BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::INTEGER FROM cart_abandonments WHERE email_sent_at > NOW() - INTERVAL '7 days'),
    (SELECT COUNT(*)::INTEGER FROM orders WHERE reorder_reminder_sent_at > NOW() - INTERVAL '7 days'),
    (SELECT COUNT(*)::INTEGER FROM orders WHERE winback_email_sent_at > NOW() - INTERVAL '7 days'),
    (SELECT COUNT(*)::INTEGER FROM newsletter_subscribers WHERE welcome_stage > 0),
    (SELECT COUNT(*)::INTEGER FROM newsletter_subscribers WHERE welcome_stage = 3),
    (SELECT MAX(email_sent_at) FROM cart_abandonments),
    (SELECT MAX(reorder_reminder_sent_at) FROM orders),
    (SELECT MAX(winback_email_sent_at) FROM orders),
    (SELECT COALESCE(SUM(o.total_cents), 0)::BIGINT
       FROM cart_abandonments ca
       JOIN orders o ON LOWER(o.email) = LOWER(ca.email)
                     AND o.created_at > ca.email_sent_at
                     AND o.payment_status = 'paid'
     WHERE ca.email_sent_at IS NOT NULL);
$$;

GRANT EXECUTE ON FUNCTION get_email_automation_stats() TO authenticated;
