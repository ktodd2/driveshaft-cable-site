-- Auto-decrement product_inventory.stock_quantity when an order is paid.
--
-- Replaces the previous webhook-only mechanism, which silently failed when
-- the Stripe webhook wasn't reaching the edge function. By moving the
-- decrement into a database trigger, stock is updated whenever ANY code path
-- marks the order paid (client-side success page, payment form, or webhook).
--
-- Idempotent and safe to re-run.

-- 1. Ensure the idempotency flag column exists.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_decremented BOOLEAN DEFAULT false;

-- 2. Trigger function: decrement stock for each item when payment_status flips to 'paid'.
CREATE OR REPLACE FUNCTION orders_decrement_stock_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
BEGIN
  -- Only the stock_decremented flag gates re-runs: it lets the backfill
  -- (and any future repair UPDATEs) decrement stock for already-paid orders
  -- that were never decremented, while still preventing double-decrement.
  IF NEW.payment_status = 'paid'
     AND COALESCE(NEW.stock_decremented, false) = false
     AND NEW.items IS NOT NULL
     AND jsonb_typeof(NEW.items) = 'array' THEN

    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      BEGIN
        UPDATE product_inventory
        SET stock_quantity = GREATEST(0, stock_quantity - COALESCE((item->>'quantity')::INTEGER, 0)),
            updated_at = NOW()
        WHERE product_id = item->>'productId';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'orders_decrement_stock_on_paid: failed to decrement product % (qty %): %',
          item->>'productId', item->>'quantity', SQLERRM;
      END;
    END LOOP;

    NEW.stock_decremented = true;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Replace the trigger.
DROP TRIGGER IF EXISTS orders_decrement_stock_trigger ON orders;
CREATE TRIGGER orders_decrement_stock_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_decrement_stock_on_paid();

-- 4. Backfill: fire the trigger for every paid order that hasn't been decremented yet.
-- The no-op self-update on updated_at causes the BEFORE UPDATE trigger to run.
UPDATE orders
SET updated_at = updated_at
WHERE payment_status = 'paid'
  AND COALESCE(stock_decremented, false) = false;
