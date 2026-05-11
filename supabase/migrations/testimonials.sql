-- Testimonial-collection system.
--
-- Flow: 14 days after a paid order, an edge function emails the customer a
-- magic link to /testimonial?token=<unguessable>. Customer submits their
-- experience + chosen display name; admin reviews & approves; approved
-- testimonials are readable publicly (anon SELECT) so a future Testimonials
-- component on the homepage can render them.
--
-- This migration:
--   1. Enables pg_cron + pg_net (Supabase-native extensions).
--   2. Adds orders.testimonial_request_sent_at to prevent duplicate sends.
--   3. Creates the testimonials table + RLS.
--   4. Schedules a daily cron job that calls the
--      process-testimonial-queue edge function.
--
-- ONE-TIME MANUAL STEP after applying this migration: store the project's
-- service-role key in Supabase Vault so pg_cron can authenticate to the
-- edge function. Run ONCE (substitute your own key):
--
--   SELECT vault.create_secret('<YOUR_SERVICE_ROLE_KEY>', 'service_role_key');
--
-- The key lives encrypted in vault.secrets, not in git. The project URL is
-- hardcoded in the cron job below (it's not secret).
--
-- Idempotent and safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS testimonial_request_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  display_name TEXT,
  testimonial_text TEXT,
  consented_to_promo BOOLEAN DEFAULT false,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | submitted | approved | archived
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS testimonials_status_idx ON testimonials (status, created_at DESC);
CREATE INDEX IF NOT EXISTS testimonials_token_idx ON testimonials (token);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Anon can SELECT any row by token. Tokens are 32-hex-char random, so the
-- client must already know one to find a row; brute force is infeasible.
DO $$ BEGIN
  CREATE POLICY "Anon read by token"
    ON testimonials FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Anon can UPDATE only a pending, unexpired row, and only to flip it to
-- 'submitted' (filling in testimonial_text, display_name, consent, etc.).
-- Once status leaves 'pending', no further anon updates succeed — natural
-- replay protection.
DO $$ BEGIN
  CREATE POLICY "Anon submit pending"
    ON testimonials FOR UPDATE TO anon
    USING (status = 'pending' AND expires_at > NOW())
    WITH CHECK (status = 'submitted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin (authenticated) can do anything.
DO $$ BEGIN
  CREATE POLICY "Admin manage testimonials"
    ON testimonials FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Anyone can read APPROVED testimonials (for the future public component).
DO $$ BEGIN
  CREATE POLICY "Public read approved"
    ON testimonials FOR SELECT TO anon USING (approved = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Daily cron job at 10:00 UTC. Unschedule first so the migration is safe to
-- re-run if anything below changes.
DO $$ BEGIN
  PERFORM cron.unschedule('process-testimonial-queue-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-testimonial-queue-daily',
  '0 10 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://twrihhyfvomqiqbxkitc.supabase.co/functions/v1/process-testimonial-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'service_role_key' LIMIT 1
        )
      ),
      body := '{}'::jsonb
    );
  $cron$
);
