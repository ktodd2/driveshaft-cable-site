-- PREPARED ONLY. No historical classification or status changes; no newsletter/email changes.
BEGIN;
ALTER TABLE public.suggestions ADD COLUMN review_state text NOT NULL DEFAULT 'unreviewed' CHECK (review_state IN ('unreviewed','kept','quarantined')),
 ADD COLUMN review_revision bigint NOT NULL DEFAULT 0,
 ADD COLUMN reviewed_at timestamptz,
 ADD COLUMN reviewed_by uuid;
-- Also detects edits from legacy/service clients; prevents ABA status races.
CREATE FUNCTION public.bump_suggestion_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN NEW.review_revision := OLD.review_revision + 1; RETURN NEW; END; $$;
CREATE TRIGGER suggestion_revision BEFORE UPDATE ON public.suggestions FOR EACH ROW EXECUTE FUNCTION public.bump_suggestion_revision();
-- Active-admin RPCs are the only browser read/update path. Keep public form insert-only.
REVOKE ALL ON public.suggestions FROM PUBLIC,anon,authenticated;
GRANT INSERT(email,name,message) ON public.suggestions TO anon;
DROP POLICY IF EXISTS "Admin can read suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Admin can update suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Admin can delete suggestions" ON public.suggestions;

CREATE FUNCTION public.get_suggestion_review() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND is_active IS TRUE) THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('checked_at',now(),'rows',coalesce(jsonb_agg(to_jsonb(s) ORDER BY created_at DESC,id),'[]'::jsonb),
 'counts',jsonb_build_object('total',count(*),'attention',count(*) FILTER(WHERE status='new' AND review_state<>'quarantined'),'quarantined',count(*) FILTER(WHERE review_state='quarantined'))) FROM public.suggestions s);
END; $$;
CREATE FUNCTION public.get_suggestion_attention() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND is_active IS TRUE) THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('checked_at',now(),'attention',count(*) FILTER(WHERE status='new' AND review_state<>'quarantined')) FROM public.suggestions);
END; $$;
CREATE FUNCTION public.review_suggestion(p_id uuid,p_revision bigint,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND is_active IS TRUE) THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('keep','quarantine','restore','read','new','archive') THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023'; END IF;
 UPDATE public.suggestions SET
 review_state=CASE p_action WHEN 'keep' THEN 'kept' WHEN 'restore' THEN 'kept' WHEN 'quarantine' THEN 'quarantined' ELSE review_state END,
 status=CASE p_action WHEN 'read' THEN 'read' WHEN 'new' THEN 'new' WHEN 'archive' THEN 'archived' ELSE status END,
 reviewed_at=now(),reviewed_by=auth.uid()
 WHERE id=p_id AND review_revision=p_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'Record changed; refresh before deciding' USING ERRCODE='40001'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.get_suggestion_review(),public.get_suggestion_attention(),public.review_suggestion(uuid,bigint,text),public.bump_suggestion_revision() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_suggestion_review(),public.get_suggestion_attention(),public.review_suggestion(uuid,bigint,text) TO authenticated;
COMMIT;
