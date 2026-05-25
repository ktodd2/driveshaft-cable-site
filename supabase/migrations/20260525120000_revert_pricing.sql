-- Roll prices back to the original structure: Cable starts at $3.00 / tiers
-- $2.90 / $2.70 / $2.45; Cable+ at $3.50 / $3.40 / $3.20 / $2.95 (same dollar
-- deltas: -$0.10 / -$0.30 / -$0.55 off base). These replace the higher
-- $3.45 / $3.95 bases that were set when Cable+ launched.

UPDATE products SET
  base_price_cents = 300,
  tiers = '[
    {"min": 50,  "price": 290},
    {"min": 100, "price": 270},
    {"min": 200, "price": 245}
  ]'::jsonb,
  updated_at = NOW()
WHERE id = '1';

UPDATE products SET
  base_price_cents = 350,
  tiers = '[
    {"min": 50,  "price": 340},
    {"min": 100, "price": 320},
    {"min": 200, "price": 295}
  ]'::jsonb,
  updated_at = NOW()
WHERE id = '2';
