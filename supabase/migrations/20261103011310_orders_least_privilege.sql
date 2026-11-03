-- STAGED CUTOVER ONLY: apply after secure checkout backend AND frontend have been deployed and tested.
-- No data changes, new deletion powers, historical backfill, or schedule changes.
BEGIN;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow reading own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.orders;
DROP POLICY IF EXISTS "Allow anonymous payment status updates" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can update orders" ON public.orders;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND roles && ARRAY['anon','authenticated','public']::name[]) THEN RAISE EXCEPTION 'Unexpected order policy; review current policies before cutover'; END IF; END $$;
REVOKE ALL ON public.orders FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.orders TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.orders TO service_role;
CREATE POLICY orders_active_admin_select ON public.orders FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.admin_users WHERE id=(SELECT auth.uid()) AND is_active IS TRUE));
CREATE POLICY orders_active_admin_insert ON public.orders FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.admin_users WHERE id=(SELECT auth.uid()) AND is_active IS TRUE));
CREATE POLICY orders_active_admin_update ON public.orders FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.admin_users WHERE id=(SELECT auth.uid()) AND is_active IS TRUE)) WITH CHECK(EXISTS(SELECT 1 FROM public.admin_users WHERE id=(SELECT auth.uid()) AND is_active IS TRUE));
-- Defense in depth: trigger invocation continues; direct browser EXECUTE is unnecessary.
REVOKE ALL ON FUNCTION public.orders_decrement_stock_on_paid() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_email_automation_stats()
RETURNS TABLE(abandoned_cart_sent_7d integer,reorder_sent_7d integer,winback_sent_7d integer,welcome_started_total integer,welcome_completed_total integer,abandoned_cart_last_run timestamptz,reorder_last_run timestamptz,winback_last_run timestamptz,recovered_cart_revenue_cents bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND is_active IS TRUE) THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT
 (SELECT count(*)::integer FROM public.cart_abandonments WHERE email_sent_at>now()-interval '7 days'),
 (SELECT count(*)::integer FROM public.orders WHERE reorder_reminder_sent_at>now()-interval '7 days'),
 (SELECT count(*)::integer FROM public.orders WHERE winback_email_sent_at>now()-interval '7 days'),
 (SELECT count(*)::integer FROM public.newsletter_subscribers WHERE welcome_stage>0),
 (SELECT count(*)::integer FROM public.newsletter_subscribers WHERE welcome_stage=3),
 (SELECT max(email_sent_at) FROM public.cart_abandonments),
 (SELECT max(reorder_reminder_sent_at) FROM public.orders),
 (SELECT max(winback_email_sent_at) FROM public.orders),
 (SELECT coalesce(sum(o.total_cents),0)::bigint FROM public.cart_abandonments ca JOIN public.orders o ON lower(o.email)=lower(ca.email) AND o.created_at>ca.email_sent_at AND o.payment_status='paid' WHERE ca.email_sent_at IS NOT NULL);
END; $$;
REVOKE ALL ON FUNCTION public.get_email_automation_stats() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_automation_stats() TO authenticated;
COMMIT;
