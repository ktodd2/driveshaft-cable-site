-- Add payment_method to orders so manual in-person sales (cash, Zelle, CashApp,
-- Stripe payment link) can be distinguished from website checkout orders. Used
-- by analytics to gate the 2.9% + $0.30 Stripe processing fee — only 'stripe'
-- payments incur it.
--
-- Idempotent and safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Backfill: every paid order in the database to date came through Stripe checkout.
UPDATE orders
SET payment_method = 'stripe'
WHERE payment_status = 'paid' AND payment_method IS NULL;

-- Constrain values so typos in admin UI fail loudly instead of silently fragmenting analytics.
DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('stripe', 'cash', 'zelle', 'cashapp'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
