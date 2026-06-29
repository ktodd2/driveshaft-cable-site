-- Sell product '3' (Value Brake Caging Bolt) as a PACK OF 10.
--
-- The bolt was originally listed and priced as an individual unit ($4.00 each
-- with per-bolt volume tiers). The owner now sells it as a 10-pack: one pack is
-- one line item at $21.99, with a per-pack volume discount.
--
--   Base:      $21.99/pack  (2199c)
--   5+  packs: $20.99/pack  (2099c)
--   10+ packs: $19.99/pack  (1999c)
--   20+ packs: $18.99/pack  (1899c)
--
-- Tier `min` values match the order quantity, which is now a count of PACKS.
-- min_order_quantity / order_quantity_step stay at 1 — the customer still buys
-- "1 item", which is now one pack of 10.
--
-- Plain UPDATE, so it is naturally idempotent and safe to re-run.

UPDATE products
SET
  name = 'Value Brake Caging Bolt (10-Pack)',
  base_price_cents = 2199,
  tiers = '[{"min":20,"price":1899},{"min":10,"price":1999},{"min":5,"price":2099}]'::jsonb,
  short_description = 'Pack of 10 heavy-duty spring brake release bolts with an 18mm hex (NOT the standard 3/4" / 19mm). Bring the right socket.',
  description = $$Sold in packs of 10. The Value Brake Caging Bolt is a purpose-built spring brake release tool for heavy-duty trucks, trailers, and transit buses that run air-actuated parking brakes. When the system loses air pressure — broken truck, dead trailer, towing a wreck — the spring in the brake chamber extends and locks the wheels. The caging bolt threads into the back of the chamber and mechanically pulls that spring back so the brake releases and the vehicle can be moved.

The single thing every operator needs to know about this bolt: the hex is 18mm. The standard brake caging bolt across most rigs is 3/4" (19mm). This is the value variant — same function, lower price, but a 19mm socket will not turn it. Bring an 18mm socket on the truck and you'll be fine; bring the standard one and you'll be stuck.

Built from heat-treated steel to handle the spring load without shearing. Sized for the common T-series spring brake chambers found on Class 7-8 tractors, semi-trailers, transit buses, and vocational trucks. Always confirm your chamber's specs before use.$$,
  specs = '{
    "Pack Size": "10 bolts per pack",
    "Hex Size": "18mm (NOT 3/4\"/19mm)",
    "Function": "Manually cages spring brake to release parking brake",
    "Material": "Heat-treated steel",
    "Use Case": "Required when towing or moving vehicles with no air pressure",
    "Standard Variant": "Most caging bolts use 3/4\" (19mm) hex — confirm your socket before use"
  }'::jsonb
WHERE id = '3';
