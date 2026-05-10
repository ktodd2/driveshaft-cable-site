-- Allow signed-in admin users to insert orders (manual in-person sales).
-- Mirrors the existing "Admin can update orders" / "Admin can view all orders"
-- policies. Public checkout uses a separate anon-role INSERT policy and is
-- unaffected by this change.
DO $$ BEGIN
  CREATE POLICY "Admin can insert orders"
    ON orders FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
