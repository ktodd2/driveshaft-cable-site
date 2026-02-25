# Database Setup Instructions

## ⚠️ IMPORTANT: Follow This Order!

Run these SQL files **IN ORDER** in your Supabase SQL Editor. Do NOT copy the markdown code blocks (```sql), only copy the actual SQL code from the `.sql` files.

### Setup Steps:

1. **Open Supabase Dashboard** → **SQL Editor**

2. **Run in this order:**

   **Step 1:** `01_CREATE_TABLES.sql`
   - Creates all database tables
   - Copy the ENTIRE file contents and paste into SQL Editor
   - Click **Run**

   **Step 2:** `02_SECURITY_POLICIES.sql`
   - Sets up Row Level Security policies
   - Copy the ENTIRE file contents and paste into SQL Editor
   - Click **Run**

   **Step 3:** `03_SEED_PRODUCT.sql`
   - Creates your product with 500 units initial stock
   - Copy the ENTIRE file contents and paste into SQL Editor
   - Click **Run**

   **Step 4:** `04_INVENTORY_FUNCTIONS.sql`
   - Adds inventory management functions
   - Copy the ENTIRE file contents and paste into SQL Editor
   - Click **Run**

3. **Create Admin User:**
   - Go to **Authentication** → **Users**
   - Click **Add user** → **Create new user**
   - Enter your email and password
   - Copy the user's UUID from the table
   - Run this SQL (replace with your UUID):
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

4. **Verify Setup:**
   ```sql
   SELECT name, sku, stock_quantity, low_stock_threshold 
   FROM products 
   WHERE sku = 'KTDC-001';
   ```
   
   Should return:
   - name: K.Todd Driveshaft Cable
   - sku: KTDC-001
   - stock_quantity: 500
   - low_stock_threshold: 100

## Common Errors

### "syntax error at or near ```"
**Problem:** You copied markdown formatting
**Solution:** Open the `.sql` files directly and copy ONLY the SQL code (no ```sql or ``` markers)

### "relation 'products' does not exist"
**Problem:** You skipped Step 1 (01_CREATE_TABLES.sql)
**Solution:** Run Step 1 first, then continue with the other steps

### "duplicate key value violates unique constraint"
**Problem:** You already ran the seed script
**Solution:** This is OK! The product already exists. Continue to next step.

## File Reference

- `01_CREATE_TABLES.sql` - Base database schema
- `02_SECURITY_POLICIES.sql` - Security & permissions
- `03_SEED_PRODUCT.sql` - Product data (500 units)
- `04_INVENTORY_FUNCTIONS.sql` - Inventory management
- `INVENTORY_MANAGEMENT_GUIDE.md` - Usage guide after setup
- `SUPABASE_SETUP.md` - Detailed reference documentation

## Next Steps

After database setup is complete:
1. Add your Supabase credentials to `.env` file
2. Go to `/admin/login` and sign in
3. Access inventory management at `/admin/inventory`
4. See `INVENTORY_MANAGEMENT_GUIDE.md` for usage instructions
