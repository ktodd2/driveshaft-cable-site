-- Add total_quantity column to track lifetime inventory received
-- total_quantity increases when shipments arrive, never decreases on sales
-- This powers the inventory progress bar: sold = total_quantity - stock_quantity
ALTER TABLE product_inventory ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 0;
