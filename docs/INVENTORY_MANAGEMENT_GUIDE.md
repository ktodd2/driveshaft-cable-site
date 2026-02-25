# Inventory Management System - Setup & Usage Guide

## Overview

Your driveshaft cable site now has a complete inventory management system that:
- ✅ Tracks stock levels in real-time
- ✅ Automatically deducts inventory when orders are paid
- ✅ Prevents overselling with stock validation
- ✅ Shows low stock warnings at 100 units threshold
- ✅ Provides admin control panel for inventory adjustments
- ✅ Maintains complete audit trail of all changes

## Initial Setup

### Step 1: Run Database Setup SQL

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `docs/INVENTORY_SETUP.sql`
4. Copy and paste the entire SQL script
5. Click **Run** to execute

This will:
- Add inventory tracking fields to products table
- Create database functions for inventory management
- Set up the initial 500 units of stock for your product
- Create inventory log for audit trail
- Add low stock view for alerts

### Step 2: Verify Product Setup

After running the SQL, verify your product has been set up:

```sql
SELECT name, sku, stock_quantity, low_stock_threshold 
FROM products 
WHERE sku = 'KTDC-001';
```

You should see:
- **stock_quantity**: 500
- **low_stock_threshold**: 100

## How It Works

### Customer Flow

1. **Product Page**: Customers see real-time stock levels
   - "In Stock - 500 available" (when > 100 units)
   - "Low Stock - 95 left" (when ≤ 100 units)
   - "Out of Stock" (when 0 units)

2. **Add to Cart**: Customers can add items but no inventory is reserved yet

3. **Checkout**: Stock validation occurs before payment
   - Checks if sufficient stock available
   - Prevents checkout if stock insufficient
   - Shows error message with available quantity

4. **Payment Success**: Inventory is automatically deducted
   - Only deducted after successful payment
   - Each item in order is deducted
   - Change is logged in inventory_log table
   - Prevents double-deduction if page refreshed

### Admin Management

#### Accessing Inventory Management

1. Log into admin: `/admin/login`
2. Navigate to **Inventory** from sidebar
3. Or go directly to `/admin/inventory`

#### Dashboard Overview

The admin dashboard shows:
- **Total Stock**: Total units across all products
- **Low Stock Alerts**: Products below threshold
- **Quick Access**: Link to inventory management

#### Managing Inventory

**Add Inventory** (When receiving new stock):
1. Click "Add" button next to product
2. Enter quantity to add (e.g., 100)
3. Select reason: "Stock Received"
4. Add notes (optional): "Received shipment from manufacturer"
5. Click "Confirm"

**Set Inventory** (When doing physical count):
1. Click "Set" button next to product
2. Enter exact new quantity (e.g., 485)
3. Select reason: "Inventory Correction"
4. Add notes: "Physical count adjustment"
5. Click "Confirm"

**View History**:
- Scroll down to see complete inventory log
- Shows date, product, change amount, reason, and who made the change

## Stock Levels & Alerts

### Thresholds

- **Minimum Order**: 10 units
- **Low Stock Warning**: 100 units (configurable per product)
- **Prevent Overselling**: Cannot sell more than available

### Low Stock Alerts

When stock drops to or below 100 units:
- ⚠️ Admin dashboard shows warning
- 🟡 Product page shows "Low Stock" badge
- 📊 Inventory page highlights product in yellow

When stock reaches 0:
- 🔴 Product page shows "Out of Stock"
- 🚫 Add to cart button disabled
- ❌ Checkout prevented for orders in progress

## Inventory Log & Audit Trail

Every inventory change is logged with:
- **Date/Time**: When the change occurred
- **Product**: Which product was affected
- **Change**: Amount added or subtracted
- **Reason**: Why the change was made
  - `order`: Deducted for customer order
  - `stock_received`: New stock arrived
  - `manual_adjustment`: Admin adjustment
  - `damaged`: Damaged/lost inventory
  - `correction`: Physical count correction
  - `return`: Customer return
  - `initial_stock`: Initial setup
- **Notes**: Additional details
- **Admin User**: Who made the change (for manual adjustments)
- **Order Reference**: Order ID (for order deductions)

## Common Scenarios

### Scenario 1: Receiving New Inventory

You receive 200 new units from manufacturer:

1. Go to `/admin/inventory`
2. Click **Add** next to "K.Todd Driveshaft Cable"
3. Enter **200** in quantity field
4. Select **Stock Received** as reason
5. Add note: "PO #12345 - Manufacturer shipment"
6. Click **Confirm**
7. Stock increases from 500 → 700

### Scenario 2: Physical Inventory Count

You do a physical count and find 478 units (not the 500 shown):

1. Go to `/admin/inventory`
2. Click **Set** next to product
3. Enter **478** as new quantity
4. Select **Inventory Correction** as reason
5. Add note: "Monthly physical count - 22 units discrepancy"
6. Click **Confirm**
7. Stock set to exactly 478
8. Log shows -22 change

### Scenario 3: Damaged Inventory

10 units were damaged during shipping:

1. Go to `/admin/inventory`
2. Click **Add** next to product
3. Enter **-10** (negative number to subtract)
4. Select **Damaged** as reason
5. Add note: "Damaged in transit - RMA #789"
6. Click **Confirm**
7. Stock decreases by 10

### Scenario 4: Customer Order

Customer orders 25 units and pays successfully:

1. **Automatic**: No admin action needed!
2. On payment success page:
   - Order status updated to "paid"
   - Inventory automatically deducted: 500 → 475
   - Log entry created with order reference
   - Cannot be deducted twice (has safeguard)

### Scenario 5: Low Stock Alert

Stock drops to 95 units:

1. Admin dashboard shows yellow warning
2. Click "View details" link
3. See product highlighted in inventory page
4. Decide to reorder from supplier
5. Add new inventory when received

## Customization

### Change Low Stock Threshold

To change the threshold from 100 to a different number:

```sql
UPDATE products
SET low_stock_threshold = 50  -- Change to your desired threshold
WHERE sku = 'KTDC-001';
```

### Add More Products

When adding new products, make sure to include:

```sql
INSERT INTO products (
  name, slug, sku, 
  stock_quantity, 
  low_stock_threshold,
  track_inventory,
  price_cents,
  -- ... other fields
) VALUES (
  'New Product', 'new-product', 'SKU-002',
  100,  -- initial stock
  25,   -- low stock threshold
  true, -- track inventory
  2500, -- $25.00
  -- ... other values
);
```

## Troubleshooting

### Issue: Inventory not deducting on orders

**Check:**
1. Verify order payment_status is 'paid'
2. Check order_items table has product_id correctly
3. Look at inventory_log for any error logs
4. Ensure product has track_inventory = true

**Fix:** Manually deduct if needed via admin panel

### Issue: Stock shows wrong amount

**Solution:**
1. Do a physical count
2. Use "Set" function to correct the amount
3. Add note explaining the correction

### Issue: Low stock alert not showing

**Check:**
1. Verify stock_quantity ≤ low_stock_threshold
2. Check product is_active = true
3. Refresh admin dashboard

### Issue: Cannot checkout even with stock available

**Check:**
1. Verify stock_quantity in database
2. Check for any locking issues
3. Try refreshing product page
4. Check browser console for errors

## Security

- ✅ Inventory functions use row-level security
- ✅ Only authenticated admins can adjust inventory
- ✅ All changes are logged with admin user ID
- ✅ Database functions prevent negative stock
- ✅ Atomic operations prevent race conditions

## Database Functions Reference

### deduct_inventory(product_id, quantity, order_id)
Deducts inventory when order is paid. Automatically called.

### add_inventory(product_id, quantity, reason, notes, admin_user_id)
Adds inventory. Use negative quantity to subtract.

### set_inventory(product_id, new_quantity, reason, notes, admin_user_id)
Sets inventory to exact amount. Calculates and logs the difference.

### check_stock_available(product_id, quantity)
Returns true/false if enough stock available. Called during checkout.

## Support

For issues or questions:
- Email: houstontruckwreck@gmail.com
- Check inventory_log table for audit trail
- Review Supabase logs for errors

---

**Current Configuration:**
- Initial Stock: 500 units
- Low Stock Threshold: 100 units
- Product: K.Todd Driveshaft Cable (KTDC-001)
- Inventory Tracking: Enabled
- Prevents Negative Stock: Yes
