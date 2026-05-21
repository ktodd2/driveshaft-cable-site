-- Seed the inventory row for Driveshaft Cable + (product_id = '2').
-- Starting stock is 0; the admin sets the real number via /admin/orders
-- once physical inventory is on hand.
INSERT INTO product_inventory (product_id, stock_quantity, total_quantity, updated_at)
VALUES ('2', 0, 0, NOW())
ON CONFLICT (product_id) DO NOTHING;
