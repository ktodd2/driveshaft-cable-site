-- Add Stripe Tax columns to orders so each sale records:
--   tax_cents                    — tax amount in cents that was charged to the customer
--   stripe_tax_calculation_id    — the calculation quote produced before payment (tx_...)
--   stripe_tax_transaction_id    — the finalized transaction produced after payment,
--                                  which is what appears in Stripe Tax reports
--
-- Without all three, Stripe Tax cannot produce filing-ready state reports.
--
-- Idempotent and safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_tax_calculation_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_tax_transaction_id TEXT;

-- Existing rows pre-date Stripe Tax integration, so tax_cents = 0 is correct for them.
-- No backfill is performed; those orders were sold tax-inclusive from the customer's
-- perspective and any historical filing decision is a CPA conversation, not a data task.
