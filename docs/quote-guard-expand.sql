-- Expand phase only. Preserve all existing quotes and access until cutover.
CREATE TABLE IF NOT EXISTS public.quote_submission_guard (
  quote_id bigint PRIMARY KEY REFERENCES public.quote_requests(id),
  request_hash text NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  email_hash text NOT NULL,
  ip_hash text NOT NULL,
  review_state text NOT NULL CHECK (review_state IN ('accepted','quarantined')),
  reasons text[] NOT NULL DEFAULT '{}',
  notification_state text NOT NULL DEFAULT 'pending' CHECK(notification_state IN ('pending','sending','sent','failed','unknown','suppressed')),
  notification_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_submission_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_submission_guard FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.quote_submission_guard TO service_role;
CREATE INDEX IF NOT EXISTS quote_guard_payload_idx ON public.quote_submission_guard(payload_hash,created_at);
CREATE INDEX IF NOT EXISTS quote_guard_ip_idx ON public.quote_submission_guard(ip_hash,created_at);
CREATE INDEX IF NOT EXISTS quote_guard_email_idx ON public.quote_submission_guard(email_hash,created_at);

CREATE OR REPLACE FUNCTION public.submit_quote_guarded(p_quote jsonb,p_request_hash text,p_payload_hash text,p_email_hash text,p_ip_hash text,p_reasons text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE existing public.quote_submission_guard; new_id bigint; reasons text[] := coalesce(p_reasons,'{}'); ip_count int; email_count int; global_count int;
BEGIN
  -- Low-volume endpoint: one transaction-scoped lock makes counts and retries atomic.
  PERFORM pg_advisory_xact_lock(7142539812002);
  SELECT * INTO existing FROM public.quote_submission_guard WHERE request_hash=p_request_hash;
  IF FOUND THEN
    IF existing.payload_hash<>p_payload_hash THEN RETURN jsonb_build_object('conflict',true); END IF;
    RETURN jsonb_build_object('duplicate',true,'quote_id',existing.quote_id,'notify',existing.review_state='accepted' AND existing.notification_state='pending');
  END IF;
  SELECT * INTO existing FROM public.quote_submission_guard WHERE payload_hash=p_payload_hash AND created_at>now()-interval '24 hours' ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('duplicate',true,'quote_id',existing.quote_id,'notify',existing.review_state='accepted' AND existing.notification_state='pending'); END IF;
  SELECT count(*) INTO ip_count FROM public.quote_submission_guard WHERE ip_hash=p_ip_hash AND created_at>now()-interval '1 hour';
  SELECT count(*) INTO email_count FROM public.quote_submission_guard WHERE email_hash=p_email_hash AND created_at>now()-interval '1 hour';
  SELECT count(*) INTO global_count FROM public.quote_submission_guard WHERE created_at>now()-interval '1 hour';
  IF ip_count>=20 OR email_count>=10 OR global_count>=200 THEN RETURN jsonb_build_object('limited',true); END IF;
  IF ip_count>=5 THEN reasons:=array_append(reasons,'ip_frequency'); END IF;
  IF email_count>=3 THEN reasons:=array_append(reasons,'email_frequency'); END IF;
  INSERT INTO public.quote_requests(name,company,email,phone,quantity,message,status,created_at)
  VALUES(p_quote->>'name',p_quote->>'company',p_quote->>'email',p_quote->>'phone',(p_quote->>'quantity')::integer,p_quote->>'message',CASE WHEN cardinality(reasons)>0 THEN 'quarantined' ELSE 'new' END,now()) RETURNING id INTO new_id;
  INSERT INTO public.quote_submission_guard(quote_id,request_hash,payload_hash,email_hash,ip_hash,review_state,reasons,notification_state)
  VALUES(new_id,p_request_hash,p_payload_hash,p_email_hash,p_ip_hash,CASE WHEN cardinality(reasons)>0 THEN 'quarantined' ELSE 'accepted' END,reasons,CASE WHEN cardinality(reasons)>0 THEN 'suppressed' ELSE 'pending' END);
  RETURN jsonb_build_object('quote_id',new_id,'notify',cardinality(reasons)=0);
END $$;
REVOKE ALL ON FUNCTION public.submit_quote_guarded(jsonb,text,text,text,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quote_guarded(jsonb,text,text,text,text,text[]) TO service_role;
