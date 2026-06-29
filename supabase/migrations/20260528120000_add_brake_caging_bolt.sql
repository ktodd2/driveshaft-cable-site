-- Add product '3' — Value Brake Caging Bolt.
--
-- The "value" variant of a heavy-duty brake caging bolt: same function as the
-- standard 3/4" (19mm) bolt every tow operator carries, but with an 18mm hex.
-- The product copy hammers that distinction so operators bring the right
-- socket. Pricing starts at $4 and scales to $3.40 at 200+ units, matching
-- the existing per-product bulk-discount cadence.
--
-- Images live as relative paths to public/cage/ (same pattern Driveshaft
-- Cable uses with /inuse.jpeg / /IMG_*.jpeg). Admin can move them to
-- product-images storage later via /admin/products if desired.
--
-- Idempotent and safe to re-run.

INSERT INTO products (
  id, name, sku, slug,
  base_price_cents, tiers,
  short_description, description,
  tagline, showcase_bullets, cta_label,
  specs, applications, features, images,
  is_active, is_storefront, sort_order
) VALUES (
  '3',
  'Value Brake Caging Bolt',
  'KTDC-VBC-18',
  'value-brake-caging-bolt',
  400,
  '[{"min":200,"price":340},{"min":100,"price":370},{"min":50,"price":390}]'::jsonb,
  'Heavy-duty spring brake release bolt with an 18mm hex (NOT the standard 3/4" / 19mm). Bring the right socket.',
  $$The Value Brake Caging Bolt is a purpose-built spring brake release tool for heavy-duty trucks, trailers, and transit buses that run air-actuated parking brakes. When the system loses air pressure — broken truck, dead trailer, towing a wreck — the spring in the brake chamber extends and locks the wheels. The caging bolt threads into the back of the chamber and mechanically pulls that spring back so the brake releases and the vehicle can be moved.

The single thing every operator needs to know about this bolt: the hex is 18mm. The standard brake caging bolt across most rigs is 3/4" (19mm). This is the value variant — same function, lower price, but a 19mm socket will not turn it. Bring an 18mm socket on the truck and you'll be fine; bring the standard one and you'll be stuck.

Built from heat-treated steel to handle the spring load without shearing. Sized for the common T-series spring brake chambers found on Class 7-8 tractors, semi-trailers, transit buses, and vocational trucks. Always confirm your chamber's specs before use.$$,
  '18mm value variant — bring an 18mm socket, not the standard 3/4"',
  '["18mm hex (not 3/4\"/19mm)","Releases air-spring parking brakes","Built for tow ops and roadside recovery"]'::jsonb,
  'Shop Brake Caging Bolts',
  '{
    "Hex Size": "18mm (NOT 3/4\"/19mm)",
    "Function": "Manually cages spring brake to release parking brake",
    "Material": "Heat-treated steel",
    "Use Case": "Required when towing or moving vehicles with no air pressure",
    "Standard Variant": "Most caging bolts use 3/4\" (19mm) hex — confirm your socket before use"
  }'::jsonb,
  '[
    "Tow truck and recovery operators",
    "Fleet maintenance shops",
    "Roadside service",
    "Air brake system service",
    "Class 7-8 trucks, trailers, transit buses"
  ]'::jsonb,
  '[
    {"title":"18mm Hex — NOT 3/4\"/19mm","description":"The single most important thing to know. The standard caging bolt is 3/4\" (19mm). This value variant is 18mm. Bring the right socket or you won''t be releasing anything."},
    {"title":"Releases Spring Brakes Without Air","description":"Threads into the back of a spring brake chamber and mechanically pulls the spring back, releasing the parking/emergency brake so the vehicle can be towed or moved."},
    {"title":"Heat-Treated Steel","description":"Built to handle the load of a fully-charged brake spring. Cheap bolts shear under load — these don''t."},
    {"title":"Fits Common Chambers","description":"Works with most T-series spring brake chambers found on heavy-duty trucks, trailers, and transit buses. Always verify your chamber spec before use."}
  ]'::jsonb,
  '["/cage/IMG_7335.JPG","/cage/IMG_7336.JPG","/cage/IMG_7337.JPG","/cage/IMG_7338.JPG","/cage/IMG_7339.JPG","/cage/IMG_7340.JPG"]'::jsonb,
  TRUE, TRUE, 3
)
ON CONFLICT (id) DO NOTHING;

-- Inventory row — admin will update stock_quantity via /admin/orders once
-- physical inventory arrives. Starts at 0 so the storefront shows out-of-stock.
INSERT INTO product_inventory (product_id, stock_quantity, total_quantity, updated_at)
VALUES ('3', 0, 0, NOW())
ON CONFLICT (product_id) DO NOTHING;
