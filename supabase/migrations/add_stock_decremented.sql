-- Add stock_decremented flag to orders table.
-- Separates stock-decrement idempotency from payment-status idempotency
-- so the webhook can still decrement stock even when the client-side code
-- has already marked the order as paid.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_decremented BOOLEAN DEFAULT false;
