-- Add how_heard to orders to capture the customer's answer to the checkout
-- "How did you hear about us?" question. Optional marketing signal — preset
-- choices (Google, social media, referral, etc.) or free text via the "Other"
-- option all land in this single column. Nullable, no default, since the field
-- is not required to complete checkout.
--
-- Idempotent and safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS how_heard TEXT;
