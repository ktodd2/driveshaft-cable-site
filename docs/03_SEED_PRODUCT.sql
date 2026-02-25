-- ============================================
-- STEP 3: SEED PRODUCT DATA
-- ============================================
-- Copy and paste THIS ENTIRE FILE into Supabase SQL Editor

INSERT INTO products (
  name,
  slug,
  description,
  short_description,
  price_cents,
  bulk_threshold,
  sku,
  stock_quantity,
  low_stock_threshold,
  track_inventory,
  is_active,
  weight_oz,
  specs
) VALUES (
  'K.Todd Driveshaft Cable',
  'driveshaft-cable',
  'The K.Todd Driveshaft Cable is a purpose-built safety device designed to securely suspend disconnected driveshafts during towing and recovery operations.

Built with 5/32" galvanized steel cable and heavy-duty aluminum couplers, it provides a professional, reusable solution for keeping drivelines safely secured during transport.

No more makeshift solutions with bungee cords, zip ties, or chains. The K.Todd Driveshaft Cable installs in seconds and keeps that shaft exactly where it needs to be.',
  'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
  300,
  10,
  'KTDC-001',
  500,
  100,
  true,
  true,
  19.2,
  '{
    "Cable Diameter": "5/32\" (4mm)",
    "Total Length": "1000mm (39\")",
    "Working Load Limit": "3000 lbs",
    "Cable Material": "Galvanized Steel Wire",
    "Coupler Material": "Yellow Anodized Aluminum",
    "End Construction": "Crimped Loops",
    "Weight": "1.2 lb"
  }'::jsonb
);

-- Log the initial inventory
INSERT INTO inventory_log (
  product_id,
  change_quantity,
  reason,
  notes
)
SELECT 
  id,
  500,
  'initial_stock',
  'Initial inventory setup - 500 units'
FROM products
WHERE sku = 'KTDC-001';
