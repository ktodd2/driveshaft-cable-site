-- products table — source of truth for catalog metadata that can be edited
-- via the admin /products page. Descriptions, specs, applications, features,
-- and images remain hardcoded in React for the storefront (Phase B). Only
-- fields that can change dynamically live here.
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sku             TEXT UNIQUE NOT NULL,
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  tiers           JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_storefront   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Cable + Cable+ from the current PRODUCT_PRICING constant.
INSERT INTO products (id, name, sku, base_price_cents, tiers, is_storefront, sort_order)
VALUES
  ('1', 'Driveshaft Cable',  'KTDC-001', 345,
   '[{"min":200,"price":290},{"min":100,"price":315},{"min":50,"price":335}]'::jsonb,
   TRUE, 1),
  ('2', 'Driveshaft Cable +', 'KTDC-002', 395,
   '[{"min":200,"price":340},{"min":100,"price":365},{"min":50,"price":385}]'::jsonb,
   TRUE, 2)
ON CONFLICT (id) DO NOTHING;

-- RLS — public read so the storefront can fetch pricing; admin write only.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read products"
    ON products FOR SELECT
    TO anon, authenticated
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin write products"
    ON products FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- product_shipments — add product_id, backfill, NOT NULL, FK.
ALTER TABLE product_shipments ADD COLUMN IF NOT EXISTS product_id TEXT;
UPDATE product_shipments SET product_id = '1' WHERE product_id IS NULL;
ALTER TABLE product_shipments ALTER COLUMN product_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE product_shipments
    ADD CONSTRAINT product_shipments_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS product_shipments_product_id_idx
  ON product_shipments(product_id);
