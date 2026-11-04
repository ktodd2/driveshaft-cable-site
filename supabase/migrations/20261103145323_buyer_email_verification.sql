-- LOCAL STAGED ONLY. Private short-lived buyer ownership; no Auth account or live send.
BEGIN;
ALTER TABLE public.referral_settings ADD COLUMN buyer_verification_emails_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.buyer_verification_requests(
 id uuid PRIMARY KEY,email text NOT NULL CHECK(email=lower(btrim(email)) AND length(email)<=254),
 link_hash text NOT NULL UNIQUE CHECK(link_hash ~ '^[a-f0-9]{64}$'),challenge_hash text NOT NULL UNIQUE CHECK(challenge_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '1 hour',
 used_at timestamptz,proof_hash text,delivery_channel text NOT NULL DEFAULT 'resend' CHECK(delivery_channel IN('resend','intercepted')),delivery_state text NOT NULL DEFAULT 'queued' CHECK(delivery_state IN('queued','accepted','review')),
 CHECK(proof_hash IS NULL OR proof_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX buyer_verification_requests_email_time ON public.buyer_verification_requests(email,created_at DESC);
CREATE TABLE public.buyer_verification_proofs(
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),request_id uuid NOT NULL UNIQUE REFERENCES public.buyer_verification_requests,
 email text NOT NULL CHECK(email=lower(btrim(email))),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '1 hour'
);
ALTER TABLE public.buyer_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_verification_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buyer_verification_requests,public.buyer_verification_proofs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.buyer_verification_requests,public.buyer_verification_proofs TO service_role;
CREATE FUNCTION public.buyer_checkout_needs_verification(p_email text) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN nullif(lower(btrim(p_email)),'') IS NULL THEN false
 WHEN EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(email))=lower(btrim(p_email)) AND payment_status IN('paid','refunded','partially_refunded')) THEN false
 ELSE coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) OR EXISTS(SELECT 1 FROM public.referral_first_checkouts WHERE email=lower(btrim(p_email))) END;
$$;
CREATE FUNCTION public.buyer_verification_valid(p_email text,p_hash text) RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT coalesce(p_hash ~ '^[a-f0-9]{64}$',false) AND EXISTS(SELECT 1 FROM public.buyer_verification_proofs WHERE token_hash=p_hash AND email=lower(btrim(p_email)) AND expires_at>clock_timestamp());
$$;
CREATE FUNCTION public.buyer_verification_prepare(p_id uuid,p_email text,p_link_hash text,p_challenge_hash text) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE email_key text:=lower(btrim(p_email)); existing public.buyer_verification_requests; at_time timestamptz:=clock_timestamp();
BEGIN
 IF NOT coalesce((SELECT enabled AND buyer_verification_emails_enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Buyer verification delivery is unavailable'; END IF;
 IF email_key IS NULL OR length(email_key)>254 OR email_key !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR p_id IS NULL OR p_link_hash IS NULL OR p_challenge_hash IS NULL OR p_link_hash !~ '^[a-f0-9]{64}$' OR p_challenge_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid verification request'; END IF;
 -- One bounded transaction serializes global and per-email mail budgets; no email ownership or first-checkout claim is granted here.
 PERFORM pg_advisory_xact_lock(55541,1);
 at_time:=clock_timestamp();
 SELECT * INTO existing FROM public.buyer_verification_requests WHERE id=p_id;
 IF FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.buyer_verification_requests WHERE challenge_hash=p_challenge_hash) THEN RETURN false; END IF;
 -- Links remain valid for the entire hourly budget window; resends never invalidate prior links.
 IF EXISTS(SELECT 1 FROM public.buyer_verification_requests WHERE email=email_key AND created_at>at_time-interval '1 minute')
 OR (SELECT count(*) FROM public.buyer_verification_requests WHERE email=email_key AND created_at>at_time-interval '1 hour')>=3
 OR (SELECT count(*) FROM public.buyer_verification_requests WHERE created_at>at_time-interval '1 hour')>=25
 OR (SELECT count(*) FROM public.buyer_verification_requests WHERE created_at>at_time-interval '1 day')>=100
 OR (SELECT count(*) FROM public.buyer_verification_requests WHERE created_at>=date_trunc('month',at_time AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=1000 THEN RETURN false; END IF;
 INSERT INTO public.buyer_verification_requests(id,email,link_hash,challenge_hash,created_at,expires_at) VALUES(p_id,email_key,p_link_hash,p_challenge_hash,at_time,at_time+interval '1 hour');
 RETURN true;
END; $$;
CREATE FUNCTION public.buyer_verification_consume(p_link_hash text,p_proof_hash text) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE request public.buyer_verification_requests; proof public.buyer_verification_proofs; at_time timestamptz:=clock_timestamp();
BEGIN
 IF NOT coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Verification is unavailable'; END IF;
 IF p_link_hash IS NULL OR p_proof_hash IS NULL OR p_link_hash !~ '^[a-f0-9]{64}$' OR p_proof_hash !~ '^[a-f0-9]{64}$' OR p_link_hash=p_proof_hash THEN RAISE EXCEPTION 'Verification is unavailable'; END IF;
 SELECT * INTO request FROM public.buyer_verification_requests WHERE link_hash=p_link_hash FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verification is unavailable'; END IF;
 at_time:=clock_timestamp();
 IF request.used_at IS NOT NULL THEN
  -- Only the same receiver-chosen proof may recover a lost consume response; no polling API issues that proof.
  SELECT * INTO proof FROM public.buyer_verification_proofs WHERE token_hash=p_proof_hash AND request_id=request.id AND email=request.email AND expires_at>at_time;
  IF NOT FOUND OR request.proof_hash IS DISTINCT FROM p_proof_hash THEN RAISE EXCEPTION 'Verification is unavailable'; END IF;
  RETURN jsonb_build_object('email',proof.email,'expires_at',proof.expires_at);
 END IF;
 IF request.expires_at<=at_time THEN RAISE EXCEPTION 'Verification is unavailable'; END IF;
 INSERT INTO public.buyer_verification_proofs(token_hash,request_id,email,created_at,expires_at) VALUES(p_proof_hash,request.id,request.email,at_time,at_time+interval '1 hour') RETURNING * INTO proof;
 UPDATE public.buyer_verification_requests SET used_at=at_time,proof_hash=p_proof_hash WHERE id=request.id;
 RETURN jsonb_build_object('email',proof.email,'expires_at',proof.expires_at);
END; $$;
CREATE OR REPLACE FUNCTION public.referral_validate_checkout(p_id uuid,p_order jsonb,p_params jsonb) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE email_key text:=lower(btrim(p_order->>'email')); expected jsonb; code_key text:=coalesce(p_params#>>'{metadata,referral_code}',''); claim public.referral_first_checkouts;
BEGIN
 IF p_params#>>'{metadata,referral_pricing_version}' IS DISTINCT FROM 'v2' THEN
  -- An old backend may prepare ordinary checkouts during the backend-first rollout,
  -- but may never create a new code checkout under obsolete discount rules.
  IF code_key<>'' OR coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Checkout has been updated. Refresh before continuing'; END IF;
  RETURN false;
 END IF;
 IF p_params#>>'{metadata,referral_system}' IS DISTINCT FROM 'v1' THEN RAISE EXCEPTION 'Invalid referral checkout'; END IF;
 IF (p_order->>'pricing_repeat')::boolean IS DISTINCT FROM public.checkout_repeat_customer(email_key) THEN RAISE EXCEPTION 'Customer pricing changed. Review the updated quote before paying'; END IF;
 expected:=public.referral_quote_code(email_key,code_key);
 IF (p_order->'referral_policy') IS DISTINCT FROM coalesce(expected,'null'::jsonb) THEN RAISE EXCEPTION 'Code settings changed. Review the updated quote before paying'; END IF;
 IF EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(email))=email_key AND payment_status IN('paid','refunded','partially_refunded')) THEN RETURN false; END IF;
 SELECT * INTO claim FROM public.referral_first_checkouts WHERE email=email_key;
 IF FOUND AND claim.checkout_id<>p_id THEN RAISE EXCEPTION 'An unfinished first-order checkout is open for this email. Resume it or cancel it before starting another; contact us if you cannot access it'; END IF;
 IF NOT coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RETURN false; END IF;
 IF NOT public.buyer_verification_valid(email_key,p_order->>'buyer_verification_hash') THEN RAISE EXCEPTION 'Email verification required before reserving your first checkout'; END IF;
 IF EXISTS(SELECT 1 FROM public.orders o LEFT JOIN public.checkout_requests c ON c.order_id=o.id WHERE lower(btrim(o.email))=email_key AND (coalesce(o.payment_method,'stripe')='stripe' OR nullif(o.stripe_payment_intent_id,'') IS NOT NULL OR c.id IS NOT NULL) AND coalesce(o.payment_status,'') NOT IN('paid','refunded','partially_refunded') AND (c.id IS NULL OR (NOT c.first_order_coordinated AND c.cancelled_at IS NULL))) THEN RAISE EXCEPTION 'An earlier payment needs verification before another first order. Resume it or contact us'; END IF;
 RETURN true;
END; $$;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('buyer_checkout_needs_verification','buyer_verification_valid','buyer_verification_prepare','buyer_verification_consume','referral_validate_checkout') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
END LOOP; END $$;
COMMIT;
