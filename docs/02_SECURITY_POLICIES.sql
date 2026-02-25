-- ============================================
-- STEP 2: ROW LEVEL SECURITY POLICIES
-- ============================================
-- Copy and paste THIS ENTIRE FILE into Supabase SQL Editor

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PRODUCTS POLICIES
-- ============================================
-- Anyone can read active products
CREATE POLICY "Public can read active products" ON products
  FOR SELECT USING (is_active = true);

-- Admins can do everything
CREATE POLICY "Admins can manage products" ON products
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_active = true));

-- ============================================
-- ORDERS POLICIES
-- ============================================
-- Anyone can create orders
CREATE POLICY "Anyone can create orders" ON orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Admins can manage all orders
CREATE POLICY "Admins can manage orders" ON orders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_active = true));

-- ============================================
-- ORDER ITEMS POLICIES
-- ============================================
CREATE POLICY "Anyone can create order items" ON order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can manage order items" ON order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_active = true));

-- ============================================
-- CONTACT MESSAGES POLICIES
-- ============================================
CREATE POLICY "Anyone can submit contact messages" ON contact_messages
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Admins can read contact messages" ON contact_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_active = true));

-- ============================================
-- INVENTORY LOG POLICIES
-- ============================================
CREATE POLICY "Admins can read inventory log" ON inventory_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_active = true));
