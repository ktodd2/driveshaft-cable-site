# Supabase Setup Guide

This guide walks you through setting up Supabase for the K.Todd Driveshaft Cable e-commerce site.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Fill in:
   - **Name**: `driveshaft-cable` (or your preference)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose closest to Houston, TX (e.g., `us-east-1`)
4. Click **Create new project** and wait for setup to complete

## 2. Get Your API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

3. Add them to your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Create Database Tables

Go to **SQL Editor** in your Supabase dashboard and run this schema:

```sql
-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  price_cents INTEGER NOT NULL,
  bulk_threshold INTEGER DEFAULT 10,
  sku TEXT UNIQUE NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  weight_oz DECIMAL(10,2),
  specs JSONB,
  images JSONB,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  company_name TEXT,

  -- Shipping address
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_zip TEXT NOT NULL,
  shipping_country TEXT DEFAULT 'US',

  -- Billing (if different)
  billing_same_as_shipping BOOLEAN DEFAULT true,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT DEFAULT 'US',

  -- Financials
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL,

  -- Payment
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  payment_status TEXT DEFAULT 'pending',

  -- Order status
  status TEXT DEFAULT 'pending',
  tracking_number TEXT,
  shipping_carrier TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Notes
  customer_notes TEXT,
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVENTORY LOG TABLE
-- ============================================
CREATE TABLE inventory_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  change_quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  notes TEXT,
  admin_user_id UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTACT MESSAGES TABLE
-- ============================================
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPDATE QUOTE REQUESTS TABLE
-- ============================================
-- Add status column if it doesn't exist
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';

ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS quoted_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_inventory_log_product ON inventory_log(product_id, created_at DESC);
```

## 4. Set Up Row Level Security (RLS)

Run this SQL to enable security policies:

```sql
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
```

## 5. Seed Your Product Data

```sql
INSERT INTO products (
  name,
  slug,
  description,
  short_description,
  price_cents,
  bulk_threshold,
  sku,
  stock_quantity,
  is_active,
  weight_oz,
  specs
) VALUES (
  'K.Todd Driveshaft Cable',
  'driveshaft-cable',
  'The K.Todd Driveshaft Cable is a purpose-built safety device designed to securely suspend disconnected driveshafts during towing and recovery operations.

Built with 5/32" galvanized steel cable and heavy-duty aluminum couplers, it provides a professional, reusable solution for keeping drivelines safely secured during transport.',
  'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
  7999,
  10,
  'KTDC-001',
  100,
  true,
  19.2,
  '{
    "Cable Diameter": "5/32\" (4mm)",
    "Total Length": "1000mm (39\")",
    "Working Load Limit": "2400 lb",
    "Cable Material": "Galvanized Steel Wire",
    "Coupler Material": "Yellow Anodized Aluminum",
    "End Construction": "Crimped Loops",
    "Weight": "1.2 lb"
  }'::jsonb
);
```

## 6. Create Your Admin User

1. Go to **Authentication** → **Users** in Supabase
2. Click **Add user** → **Create new user**
3. Enter your email and a password
4. After creating the user, copy the user's **UUID** from the table

5. Run this SQL to make yourself an admin (replace the UUID):

```sql
INSERT INTO admin_users (id, email, name, role, is_active)
VALUES (
  'your-user-uuid-here',
  'your@email.com',
  'Your Name',
  'admin',
  true
);
```

## 7. Test Your Setup

1. Start your dev server: `npm run dev`
2. Go to `/admin/login` and sign in with your credentials
3. You should see the admin dashboard
4. Check `/admin/quotes` to see any existing quote requests

## Troubleshooting

### "Permission denied" errors
- Make sure RLS policies are set up correctly
- Check that your anon key is in the `.env` file

### Can't log into admin
- Verify the user exists in **Authentication** → **Users**
- Make sure you added them to the `admin_users` table
- Check `is_active` is `true`

### Products not showing
- Run the seed SQL to add the product
- Check `is_active` is `true` on the product
