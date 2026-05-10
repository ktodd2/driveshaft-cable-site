-- Allow null email and shipping_address on orders so manual in-person sales
-- (cash, Zelle, CashApp) can be logged without contact info or a shipping
-- address. The public checkout still requires both via HTML form validation,
-- so online orders continue to populate them.
--
-- Idempotent: ALTER ... DROP NOT NULL is a no-op when the column is already
-- nullable.
ALTER TABLE orders ALTER COLUMN email DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN shipping_address DROP NOT NULL;
