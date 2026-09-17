-- Cart abandonment attribution fix (2026-09-17)
--
-- Problem: CheckoutPage writes a cart_abandonments row as soon as an email is
-- typed at step 1, and nothing ever clears it when that same customer pays a
-- minute later. As of Sep 17, 69 of 87 rows were "abandoned" carts that were
-- paid for within the hour, recovered_order_id had never been set on any row,
-- and email_sent_at was doing double duty as a "skipped because they bought"
-- stamp. Two side effects:
--   1. Every abandoned-cart stat (admin dashboard, cash-flow reports) counted
--      completed checkouts as lost sales.
--   2. send-abandoned-cart matched orders with a case-sensitive email compare
--      while the cart email is lowercased, so ~10 customers whose order email
--      had capitals got a "forgot something?" email after paying.
--
-- Fix: whenever an order becomes paid, attribute any open cart for that email
-- (case-insensitive, opened in the 14 days before the order) to the order.
-- The hourly sender then skips rows with recovered_order_id set.

CREATE OR REPLACE FUNCTION public.mark_cart_recovered_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid')
     AND NEW.email IS NOT NULL THEN
    UPDATE cart_abandonments
       SET recovered_order_id = NEW.id
     WHERE recovered_order_id IS NULL
       AND lower(email) = lower(NEW.email)
       AND created_at <= COALESCE(NEW.created_at, NOW()) + INTERVAL '5 minutes'
       AND created_at >= COALESCE(NEW.created_at, NOW()) - INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_mark_cart_recovered ON orders;
CREATE TRIGGER orders_mark_cart_recovered
  AFTER INSERT OR UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_cart_recovered_on_paid();

-- Backfill: attribute every historic cart to the first paid order from the
-- same email placed after the cart (within 14 days).
UPDATE cart_abandonments c
   SET recovered_order_id = (
     SELECT o.id
       FROM orders o
      WHERE lower(o.email) = lower(c.email)
        AND o.payment_status = 'paid'
        AND o.created_at >= c.created_at - INTERVAL '5 minutes'
        AND o.created_at <= c.created_at + INTERVAL '14 days'
      ORDER BY o.created_at
      LIMIT 1
   )
 WHERE c.recovered_order_id IS NULL
   AND EXISTS (
     SELECT 1 FROM orders o
      WHERE lower(o.email) = lower(c.email)
        AND o.payment_status = 'paid'
        AND o.created_at >= c.created_at - INTERVAL '5 minutes'
        AND o.created_at <= c.created_at + INTERVAL '14 days'
   );

-- The sender's hot path is now "not emailed AND not recovered".
DROP INDEX IF EXISTS idx_cart_abandonments_pending;
CREATE INDEX IF NOT EXISTS idx_cart_abandonments_pending
  ON cart_abandonments (created_at)
  WHERE email_sent_at IS NULL AND recovered_order_id IS NULL;

-- Case-insensitive lookups by email (sender, attribution trigger, reports).
CREATE INDEX IF NOT EXISTS idx_cart_abandonments_email_lower
  ON cart_abandonments (lower(email));
CREATE INDEX IF NOT EXISTS idx_orders_email_lower
  ON orders (lower(email));
