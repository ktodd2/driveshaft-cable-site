-- Customer suggestion box. Public visitors INSERT via the /suggestions form;
-- admin reads/updates/deletes from /admin/suggestions. Mirrors the
-- newsletter_subscribers RLS pattern (anon INSERT, authenticated CRUD).
--
-- Idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',  -- new | read | archived
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS suggestions_created_at_idx
  ON suggestions (created_at DESC);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can submit a suggestion"
    ON suggestions FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can read suggestions"
    ON suggestions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can update suggestions"
    ON suggestions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can delete suggestions"
    ON suggestions FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
