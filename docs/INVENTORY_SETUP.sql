-- ============================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- ============================================
-- Run this SQL AFTER running the main database setup from SUPABASE_SETUP.md
-- This adds the inventory management functions and policies

-- ============================================
-- 1. ADD INVENTORY TRACKING FIELDS (if not exists)
-- ============================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;

-- Update existing product with inventory settings
UPDATE products
SET 
  low_stock_threshold = 100,
  track_inventory = true
WHERE sku = 'KTDC-001' AND low_stock_threshold IS NULL;

-- ============================================
-- 2. CREATE FUNCTION TO DEDUCT INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION deduct_inventory(
  p_product_id UUID,
  p_quantity INTEGER,
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INTEGER;
  product_name TEXT;
BEGIN
  -- Get current stock and product name
  SELECT stock_quantity, name INTO current_stock, product_name
  FROM products
  WHERE id = p_product_id AND track_inventory = true
  FOR UPDATE; -- Lock the row
  
  -- Check if product exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or inventory not tracked';
  END IF;
  
  -- Check if enough stock available
  IF current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', current_stock, p_quantity;
  END IF;
  
  -- Deduct inventory
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  -- Log the change
  INSERT INTO inventory_log (
    product_id,
    change_quantity,
    reason,
    reference_id,
    notes
  ) VALUES (
    p_product_id,
    -p_quantity,
    'order',
    p_order_id,
    format('Order deduction: %s units of %s', p_quantity, product_name)
  );
  
  RETURN TRUE;
END;
$$;

-- ============================================
-- 3. CREATE FUNCTION TO ADD INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION add_inventory(
  p_product_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add to inventory
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  -- Log the change
  INSERT INTO inventory_log (
    product_id,
    change_quantity,
    reason,
    notes,
    admin_user_id
  ) VALUES (
    p_product_id,
    p_quantity,
    p_reason,
    p_notes,
    p_admin_user_id
  );
  
  RETURN TRUE;
END;
$$;

-- ============================================
-- 4. CREATE FUNCTION TO SET INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION set_inventory(
  p_product_id UUID,
  p_new_quantity INTEGER,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INTEGER;
  change_amount INTEGER;
BEGIN
  -- Get current stock
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  -- Calculate change
  change_amount := p_new_quantity - current_stock;
  
  -- Update inventory
  UPDATE products
  SET stock_quantity = p_new_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  -- Log the change
  INSERT INTO inventory_log (
    product_id,
    change_quantity,
    reason,
    notes,
    admin_user_id
  ) VALUES (
    p_product_id,
    change_amount,
    p_reason,
    p_notes,
    p_admin_user_id
  );
  
  RETURN TRUE;
END;
$$;

-- ============================================
-- 5. CREATE FUNCTION TO CHECK STOCK AVAILABILITY
-- ============================================
CREATE OR REPLACE FUNCTION check_stock_available(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = p_product_id AND track_inventory = true;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN current_stock >= p_quantity;
END;
$$;

-- ============================================
-- 6. CREATE VIEW FOR LOW STOCK PRODUCTS
-- ============================================
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
  id,
  name,
  sku,
  stock_quantity,
  low_stock_threshold,
  (stock_quantity <= low_stock_threshold) as is_low_stock,
  (stock_quantity = 0) as is_out_of_stock
FROM products
WHERE track_inventory = true
  AND is_active = true
  AND stock_quantity <= low_stock_threshold
ORDER BY stock_quantity ASC;

-- ============================================
-- 7. UPDATE INVENTORY LOG POLICIES
-- ============================================
CREATE POLICY "Admins can read inventory log" ON inventory_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_active = true));

-- ============================================
-- DONE! Your inventory management functions are ready.
-- ============================================
-- Note: Initial stock of 500 units was set when you ran the product seed in SUPABASE_SETUP.md
