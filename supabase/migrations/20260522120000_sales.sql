-- Sales — temporary % off promotions, either site-wide or scoped to one
-- product. Storefront filters by [starts_at, ends_at] at read time, so
-- expired sales naturally stop applying without any cron sweep.
CREATE TABLE IF NOT EXISTS sales (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 99),
  scope            TEXT NOT NULL CHECK (scope IN ('sitewide', 'product')),
  product_id       TEXT REFERENCES products(id) ON DELETE CASCADE,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Sitewide sales have no product_id; product sales require one.
  CHECK ((scope = 'sitewide' AND product_id IS NULL)
      OR (scope = 'product'   AND product_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS sales_active_window_idx
  ON sales(is_active, starts_at, ends_at);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read sales"
    ON sales FOR SELECT
    TO anon, authenticated
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin write sales"
    ON sales FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
