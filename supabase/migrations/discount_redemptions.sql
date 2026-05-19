-- Discount code redemption tracking.
--
-- Two codes are valid: WELCOME5 (welcome series) and COMEBACK5 (abandoned cart
-- recovery). Both 5% off. Single-use per email. Codes are hardcoded in the
-- validate-discount-code edge function; this table only tracks redemptions
-- so the same email cannot reuse a code.
--
-- Idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (code, email)
);

-- Track which code (if any) was used on an order. Reports on COMEBACK5 vs
-- WELCOME5 conversion are simple GROUP BY queries against this column.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_code TEXT;

ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;
-- Only the service role (edge functions) writes here. No anon access.
