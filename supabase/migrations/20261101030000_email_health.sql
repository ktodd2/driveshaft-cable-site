-- PREPARED ONLY: requires release approval. No schedules or historical backfill.
BEGIN;
CREATE TABLE public.automation_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), automation text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed','review')),
 counts jsonb NOT NULL DEFAULT '{}', reason text
);
CREATE INDEX ON public.automation_runs(automation, started_at DESC);
CREATE TABLE public.email_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid REFERENCES public.automation_runs(id),
 automation text NOT NULL, entity_id text NOT NULL, dedupe_key text NOT NULL UNIQUE,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','uncertain')),
 provider_id text, reason text
);
CREATE INDEX ON public.email_attempts(started_at DESC);
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_runs, public.email_attempts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_runs, public.email_attempts TO service_role;

-- Exclude held identities before LIMIT, so uncertain attempts never starve new work.
-- Views preserve the caller's base-table/RLS permissions and are service-only.
CREATE INDEX ON public.email_attempts(automation,entity_id) WHERE status IN ('pending','uncertain','rejected');
CREATE VIEW public.email_candidates_recovery WITH (security_invoker=true) AS
 SELECT c.* FROM public.cart_abandonments c WHERE NOT EXISTS (
 SELECT 1 FROM public.email_attempts a WHERE a.automation='send-abandoned-cart' AND a.entity_id=c.id::text AND a.status IN ('pending','uncertain','rejected'));
CREATE VIEW public.email_candidates_welcome WITH (security_invoker=true) AS
 SELECT c.* FROM public.newsletter_subscribers c WHERE NOT EXISTS (
 SELECT 1 FROM public.email_attempts a WHERE a.automation='send-welcome-series' AND a.entity_id=c.id::text AND a.status IN ('pending','uncertain','rejected'));
CREATE VIEW public.email_candidates_reorder WITH (security_invoker=true) AS
 SELECT c.* FROM public.orders c WHERE NOT EXISTS (
 SELECT 1 FROM public.email_attempts a WHERE a.automation='send-reorder-reminder' AND a.entity_id=c.id::text AND a.status IN ('pending','uncertain','rejected'));
CREATE VIEW public.email_candidates_winback WITH (security_invoker=true) AS
 SELECT c.* FROM public.orders c WHERE NOT EXISTS (
 SELECT 1 FROM public.email_attempts a JOIN public.orders held ON held.id::text=a.entity_id
 WHERE a.automation='send-winback' AND lower(held.email)=lower(c.email) AND a.status IN ('pending','uncertain','rejected'));
REVOKE ALL ON public.email_candidates_recovery,public.email_candidates_welcome,public.email_candidates_reorder,public.email_candidates_winback FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.email_candidates_recovery,public.email_candidates_welcome,public.email_candidates_reorder,public.email_candidates_winback TO service_role;

CREATE FUNCTION public.get_email_health(p_order_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND is_active IS TRUE) THEN
  RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('checked_at',now(),
 'held',coalesce((SELECT jsonb_agg(h) FROM (SELECT automation,count(*) AS attempts FROM public.email_attempts WHERE status IN ('pending','uncertain','rejected') GROUP BY automation)h),'[]'),
 'runs',coalesce((SELECT jsonb_agg(r ORDER BY r.started_at DESC) FROM (SELECT * FROM public.automation_runs ORDER BY started_at DESC LIMIT 100)r),'[]'),
 'summary',coalesce((SELECT jsonb_agg(s) FROM (SELECT automation,max(started_at) AS last_attempted,max(finished_at) FILTER(WHERE status='completed') AS last_successful FROM public.automation_runs GROUP BY automation)s),'[]'),
 'emails',coalesce((SELECT jsonb_agg(e ORDER BY e.started_at DESC) FROM (SELECT id,run_id,automation,entity_id,started_at,finished_at,status,provider_id,reason FROM public.email_attempts WHERE p_order_id IS NULL OR (automation='send-tracking-email-v2' AND entity_id=p_order_id) ORDER BY started_at DESC LIMIT 100)e),'[]'));
END;
$$;
REVOKE ALL ON FUNCTION public.get_email_health(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_email_health(text) TO authenticated;
COMMIT;
