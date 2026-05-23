-- Phase 2: extend products with storefront-content columns so admin can
-- manage every per-product field (descriptions, specs, applications,
-- features, images, homepage card copy) without touching code.

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug              TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description       TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specs             JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS applications      JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS features          JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images            JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tagline           TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS showcase_bullets  JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cta_label         TEXT;

-- Seed the existing two products with the content currently hardcoded in
-- the React files so the storefront keeps rendering identically after the
-- pages switch to reading from the DB.
UPDATE products SET
  slug = 'driveshaft-cable',
  short_description = 'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
  description = $$The Driveshaft Cable is a purpose-built safety device designed to securely suspend disconnected driveshafts during towing and recovery operations.

Built with 5/32" galvanized steel cable and heavy-duty aluminum couplers, it provides a professional, single-use solution for keeping drivelines safely secured during transport. The cable is cut off after the job — no reuse, no guessing if it's still safe.

No more makeshift solutions with bungee cords, zip ties, or chains. The Driveshaft Cable installs in seconds and keeps that shaft exactly where it needs to be.$$,
  specs = '{
    "Cable Diameter": "5/32\" (4mm)",
    "Total Length": "1000mm (39\")",
    "Working Load Limit": "3000 lbs",
    "Cable Material": "Galvanized Steel Wire",
    "Coupler Material": "Yellow Anodized Aluminum",
    "End Construction": "Crimped Loops",
    "Weight": "1.2 lb"
  }'::jsonb,
  applications = '[
    "Class 7-8 Trucks",
    "Semi-Tractors",
    "Vocational Trucks",
    "Transit Buses",
    "Construction Equipment",
    "Agricultural Equipment",
    "Emergency Vehicles",
    "Military Vehicles"
  ]'::jsonb,
  features = '[
    {"title":"Prevents Driveshaft Drop","description":"Secure suspension keeps the shaft in place during entire transport."},
    {"title":"Protects Drivetrain Components","description":"Eliminates seal damage and secondary transmission failures."},
    {"title":"Faster Than Makeshift Solutions","description":"No more chains, bungees, or zip ties. Install in seconds."},
    {"title":"Compact & Field-Ready","description":"Fits in glove box or tool tray. Always ready when you need it."},
    {"title":"Single-Use by Design","description":"Cut off after each job — no reuse, no guessing if it''s still safe."}
  ]'::jsonb,
  images = '["/inuse.jpeg","/IMG_5491.jpeg","/IMG_5492.jpeg","/IMG_5493.jpeg","/IMG_5490.jpeg","/IMG_5489.jpeg"]'::jsonb,
  tagline = 'The original. Coupler positioned for angled pull paths.',
  showcase_bullets = '["Crimped aluminum coupler in standard orientation","Designed for the typical driveline geometry","5/32\" galvanized steel · 40\" · 3000 lb WLL"]'::jsonb,
  cta_label = 'Shop Driveshaft Cable'
WHERE id = '1';

UPDATE products SET
  slug = 'driveshaft-cable-plus',
  short_description = 'Reversed-coupler driveshaft cable for straight-line pull.',
  description = $$Driveshaft Cable + is the same heavy-duty driveshaft safety cable as our original, but with the red coupler reversed so it can pull in a straight line. When your driveline geometry needs a straight pull path instead of an angled one, this is the configuration you want.

Built with the same 5/32" galvanized steel cable and the same crimped aluminum coupler — just turned around. Same 40" length. Same 3000 lb working load limit. Same single-use, cut-it-off-after-the-job design.

If you've used the original Driveshaft Cable and wished the coupler faced the other way for your specific application, this is for you.$$,
  specs = '{
    "Cable Diameter": "5/32\" (4mm)",
    "Total Length": "1000mm (40\")",
    "Working Load Limit": "3000 lbs",
    "Cable Material": "Galvanized Steel Wire",
    "Coupler Material": "Anodized Aluminum (Reversed)",
    "Coupler Orientation": "Reversed — for straight-line pull",
    "End Construction": "Crimped Loops",
    "Weight": "1.2 lb"
  }'::jsonb,
  applications = '[
    "Class 7-8 Trucks",
    "Semi-Tractors",
    "Vocational Trucks",
    "Transit Buses",
    "Construction Equipment",
    "Agricultural Equipment",
    "Emergency Vehicles",
    "Military Vehicles"
  ]'::jsonb,
  features = '[
    {"title":"Straight-Line Pull","description":"Reversed coupler lets the cable pull in a straight line — ideal when geometry calls for it."},
    {"title":"Same Heavy-Duty Build","description":"Identical 5/32\" galvanized steel cable and 3000 lb WLL as the original."},
    {"title":"Prevents Driveshaft Drop","description":"Secure suspension keeps the shaft in place during entire transport."},
    {"title":"Faster Than Makeshift Solutions","description":"No more chains, bungees, or zip ties. Install in seconds."},
    {"title":"Single-Use by Design","description":"Cut off after each job — no reuse, no guessing if it''s still safe."}
  ]'::jsonb,
  images = '["/IMG_6707.jpeg","/IMG_6708.jpeg"]'::jsonb,
  tagline = 'Coupler reversed — for straight-line pull when your geometry needs it.',
  showcase_bullets = '["Same heavy-duty cable, coupler turned around","For applications that need a straight pull path","5/32\" galvanized steel · 40\" · 3000 lb WLL"]'::jsonb,
  cta_label = 'Shop Driveshaft Cable +'
WHERE id = '2';

-- Slug is the URL key now; enforce uniqueness once populated.
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON products(slug);

-- Storage bucket for admin image uploads. Public read so the storefront can
-- load images without auth; only authenticated users (admin) can upload.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public read product-images"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin write product-images"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'product-images')
    WITH CHECK (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
