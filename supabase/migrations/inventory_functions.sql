-- Atomic stock decrement — rejects if insufficient stock
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id TEXT, p_quantity INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock INTEGER;
BEGIN
  UPDATE product_inventory
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
    AND stock_quantity >= p_quantity
  RETURNING stock_quantity INTO new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;

  RETURN new_stock;
END;
$$;

-- Atomic stock increment — used by shipments
CREATE OR REPLACE FUNCTION increment_stock(p_product_id TEXT, p_quantity INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock INTEGER;
BEGIN
  UPDATE product_inventory
  SET stock_quantity = stock_quantity + p_quantity,
      total_quantity = COALESCE(total_quantity, 0) + p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
  RETURNING stock_quantity INTO new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  RETURN new_stock;
END;
$$;

-- RLS policies for product_inventory
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

-- Anyone can read stock levels (needed for product pages)
DO $$ BEGIN
  CREATE POLICY "Allow public read of inventory"
    ON product_inventory FOR SELECT
    TO anon, authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only authenticated users (admin) can update directly
DO $$ BEGIN
  CREATE POLICY "Allow authenticated update of inventory"
    ON product_inventory FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
