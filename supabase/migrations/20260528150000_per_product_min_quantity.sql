-- Per-product minimum order quantity and order step.
--
-- The Driveshaft Cables ship in 10-packs, so quantities must be multiples of
-- 10 and orders must be at least 10 units. The Value Brake Caging Bolt
-- (product 3) is sold individually, so it needs min=1 and step=1.
--
-- Existing global constants in cartStore.js remain the defaults for any
-- product that doesn't set its own; admin can change either via the
-- /admin/products form later (when those fields get added) or by editing the
-- DB directly.
--
-- Idempotent and safe to re-run.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_order_quantity  INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS order_quantity_step INTEGER NOT NULL DEFAULT 10;

UPDATE products
SET min_order_quantity = 1,
    order_quantity_step = 1
WHERE id = '3';
