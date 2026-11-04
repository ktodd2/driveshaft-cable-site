-- STAGED ONLY. Automatic delivery remains disabled; creates no scheduler and sends no email.
BEGIN;
ALTER TABLE public.referral_settings ADD COLUMN auto_statements_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN statements_started_at timestamptz,
 ADD COLUMN statement_worker_id uuid, ADD COLUMN statement_worker_until timestamptz,
 ADD COLUMN statement_last_run_at timestamptz, ADD COLUMN statement_last_counts jsonb, ADD COLUMN statement_last_reason text,
 ADD CONSTRAINT referral_statement_activation CHECK(NOT auto_statements_enabled OR statements_started_at IS NOT NULL),
 ADD CONSTRAINT referral_statement_activation_finite CHECK(statements_started_at IS NULL OR isfinite(statements_started_at));
ALTER TABLE public.referral_statements ADD COLUMN recipient_email text, ADD COLUMN recipient_name text, ADD COLUMN referral_code text;
UPDATE public.referral_statements s SET recipient_email=p.email,recipient_name=p.name,referral_code=p.code FROM public.referral_partners p WHERE p.id=s.partner_id;
ALTER TABLE public.referral_statements ALTER COLUMN recipient_email SET NOT NULL,ALTER COLUMN recipient_name SET NOT NULL,ALTER COLUMN referral_code SET NOT NULL;
CREATE FUNCTION public.referral_freeze_statement() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Statement snapshots are immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER referral_statement_immutable BEFORE UPDATE ON public.referral_statements FOR EACH ROW EXECUTE FUNCTION public.referral_freeze_statement();
CREATE FUNCTION public.referral_statement_first_due(p_started timestamptz) RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT (date_trunc('month',p_started AT TIME ZONE 'America/Chicago')+
  CASE WHEN p_started AT TIME ZONE 'America/Chicago'=date_trunc('month',p_started AT TIME ZONE 'America/Chicago') THEN interval '0 months' ELSE interval '1 month' END) AT TIME ZONE 'America/Chicago';
$$;
CREATE FUNCTION public.referral_prepare_statements(p_at timestamptz DEFAULT now(),p_limit integer DEFAULT 200,p_automatic boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE boundary timestamptz:=date_trunc('month',p_at AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago';
 period text:=to_char(p_at AT TIME ZONE 'America/Chicago','YYYY-MM'); s public.referral_settings; added integer; remaining integer; BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid statement batch size'; END IF;
 SELECT * INTO s FROM public.referral_settings WHERE id;
 IF p_automatic AND (NOT s.auto_statements_enabled OR NOT s.emails_enabled OR s.statements_started_at IS NULL OR boundary<public.referral_statement_first_due(s.statements_started_at)) THEN
  RETURN jsonb_build_object('created',0,'remaining',0,'month',period,'not_due',true);
 END IF;
 -- Missing rows, not an offset, are the durable preparation cursor. Concurrent calls share a month lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('referral-statements/'||period,7222));
 INSERT INTO public.referral_statements(partner_id,month,balance,created_at,recipient_email,recipient_name,referral_code)
 SELECT p.id,period,public.referral_balance(p.id,p_at),p_at,p.email,p.name,p.code FROM public.referral_partners p
 WHERE p.accepted_at IS NOT NULL AND p.accepted_at<=boundary AND NOT EXISTS(SELECT 1 FROM public.referral_statements x WHERE x.partner_id=p.id AND x.month=period)
 ORDER BY p.id LIMIT p_limit ON CONFLICT(partner_id,month) DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;
 SELECT count(*) INTO remaining FROM public.referral_partners p WHERE p.accepted_at IS NOT NULL AND p.accepted_at<=boundary AND NOT EXISTS(SELECT 1 FROM public.referral_statements x WHERE x.partner_id=p.id AND x.month=period);
 RETURN jsonb_build_object('created',added,'remaining',remaining,'month',period,'late',extract(day FROM p_at AT TIME ZONE 'America/Chicago')<>1);
END; $$;
-- Manual preparation does not send. Automatic runs can catch a missed 1st later in the same month.
CREATE OR REPLACE FUNCTION public.referral_monthly(p_at timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN PERFORM public.referral_prepare_statements(p_at,200,false); END; $$;
CREATE FUNCTION public.referral_statement_batch(p_limit integer DEFAULT 50,p_at timestamptz DEFAULT now()) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE s public.referral_settings; first_period text; current_period text:=to_char(p_at AT TIME ZONE 'America/Chicago','YYYY-MM'); BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid delivery batch size'; END IF;
 SELECT * INTO s FROM public.referral_settings WHERE id;
 IF NOT s.auto_statements_enabled OR NOT s.emails_enabled OR s.statements_started_at IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'remaining',0,'held',0); END IF;
 first_period:=to_char(public.referral_statement_first_due(s.statements_started_at) AT TIME ZONE 'America/Chicago','YYYY-MM');
 RETURN (WITH eligible AS (
 SELECT x.* FROM public.referral_statements x JOIN public.referral_partners p ON p.id=x.partner_id
 WHERE x.month>=first_period AND x.month<=current_period AND p.accepted_at IS NOT NULL AND
 p.accepted_at<=(to_date(x.month||'-01','YYYY-MM-DD')::timestamp AT TIME ZONE 'America/Chicago')
 ), unclaimed AS (
 SELECT x.* FROM eligible x WHERE NOT EXISTS(SELECT 1 FROM public.email_attempts a WHERE a.automation='referral-send-statement' AND a.entity_id=x.id::text)
 ), batch AS (SELECT id FROM unclaimed ORDER BY month,partner_id,id LIMIT p_limit)
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM batch b),'[]'::jsonb),
 'remaining',(SELECT count(*) FROM unclaimed),'held',(SELECT count(*) FROM eligible x WHERE EXISTS(SELECT 1 FROM public.email_attempts a WHERE a.automation='referral-send-statement' AND a.entity_id=x.id::text AND a.status<>'accepted'))));
END; $$;
CREATE FUNCTION public.referral_claim_statement_run(p_run uuid,p_at timestamptz DEFAULT now()) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_run IS NULL THEN RAISE EXCEPTION 'Run identity required'; END IF;
 UPDATE public.referral_settings SET statement_worker_id=p_run,statement_worker_until=p_at+interval '2 minutes'
 WHERE id AND auto_statements_enabled AND emails_enabled AND statements_started_at IS NOT NULL
 AND public.referral_statement_first_due(statements_started_at)<=date_trunc('month',p_at AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
 AND (statement_worker_until IS NULL OR statement_worker_until<=p_at);
 RETURN FOUND;
END; $$;
CREATE FUNCTION public.referral_finish_statement_run(p_run uuid,p_counts jsonb,p_failed boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE counts jsonb; BEGIN
 counts:=jsonb_build_object('considered',coalesce((p_counts->>'considered')::integer,0),'sent',coalesce((p_counts->>'sent')::integer,0),
 'held',coalesce((p_counts->>'held')::integer,0),'review',coalesce((p_counts->>'review')::integer,0),'duplicate',coalesce((p_counts->>'duplicate')::integer,0),'prepared',coalesce((p_counts->>'prepared')::integer,0),'paid',0);
 UPDATE public.referral_settings SET statement_worker_id=NULL,statement_worker_until=NULL,statement_last_run_at=now(),statement_last_counts=counts,
 statement_last_reason=CASE WHEN p_failed THEN 'batch_requires_review' ELSE NULL END WHERE id AND statement_worker_id=p_run;
 IF FOUND THEN INSERT INTO public.referral_audit(action,entity_id,details) VALUES('automatic_statement_batch',p_run::text,counts); END IF;
END; $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'referral_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
 END LOOP; END $$;
COMMIT;
