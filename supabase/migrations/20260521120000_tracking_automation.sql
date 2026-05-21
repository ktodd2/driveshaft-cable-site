-- Columns that drive auto-tracking. delivered_at lets analytics measure
-- delivery lead time; tracking_status stores the last EasyPost status
-- string so we can show "in transit" / "out for delivery" in the admin
-- without re-querying; tracking_last_checked_at is observability so we can
-- confirm the cron is running.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_last_checked_at TIMESTAMPTZ;

-- The cron's primary query is "every shipped order with a tracking number".
-- Partial index keeps the index small as the orders table grows.
CREATE INDEX IF NOT EXISTS orders_shipped_tracking_idx
  ON orders(status, tracking_number)
  WHERE status = 'shipped' AND tracking_number IS NOT NULL;
