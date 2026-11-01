-- Apply after the website uses the token-scoped RPCs. Requests and approvals
-- stay intact; direct table access is limited to active site administrators.
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon read by token" ON public.testimonials;
DROP POLICY IF EXISTS "Anon submit pending" ON public.testimonials;
DROP POLICY IF EXISTS "Public read approved" ON public.testimonials;
DROP POLICY IF EXISTS "Admin manage testimonials" ON public.testimonials;
CREATE POLICY "Active admins manage testimonials" ON public.testimonials
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND is_active IS TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND is_active IS TRUE));
REVOKE ALL ON TABLE public.testimonials FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO authenticated;
GRANT ALL ON TABLE public.testimonials TO service_role;
