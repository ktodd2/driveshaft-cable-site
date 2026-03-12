-- Initialize total_quantity for existing rows where it was never set.
-- Sets total_quantity = stock_quantity as a baseline (assumes all current stock is "received").
-- Future shipments via increment_stock() will add to this correctly.
-- Future sales via decrement_stock() only touch stock_quantity, so the bar stays accurate.
UPDATE product_inventory
SET total_quantity = stock_quantity
WHERE total_quantity IS NULL OR total_quantity = 0;
