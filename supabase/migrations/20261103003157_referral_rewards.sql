-- Prepared for review only. No historical awards, cron changes, or enabled sends.
BEGIN;
CREATE TABLE public.referral_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false, emails_enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.referral_settings DEFAULT VALUES;
CREATE TABLE public.referral_partners(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE CHECK(email=lower(btrim(email))),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160), code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9]{6,24}$'),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN('invited','active','paused')),
 preference text CHECK(preference IN('check','product')), mailing_address text, accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.referral_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid NOT NULL REFERENCES public.referral_partners,
 token_hash text NOT NULL UNIQUE CHECK(length(token_hash)=64), expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.referral_checkouts(
 order_id uuid PRIMARY KEY REFERENCES public.orders, email text NOT NULL CHECK(email=lower(btrim(email))),
 partner_id uuid REFERENCES public.referral_partners, merchandise_cents integer NOT NULL CHECK(merchandise_cents>=0),
 shipping_cents integer NOT NULL CHECK(shipping_cents>=0), tax_cents integer NOT NULL CHECK(tax_cents>=0),
 total_cents integer NOT NULL CHECK(total_cents=merchandise_cents+shipping_cents+tax_cents AND total_cents>0),
 intent_params jsonb NOT NULL, intent_id text UNIQUE, state text NOT NULL DEFAULT 'prepared' CHECK(state IN('prepared','observed','paid','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, paid_time_verified boolean NOT NULL DEFAULT false, observed_unpaid_at timestamptz, first_observed_at timestamptz, refunded_total_cents integer NOT NULL DEFAULT 0, merchandise_refund_cents integer NOT NULL DEFAULT 0, refund_review boolean NOT NULL DEFAULT false, disputed boolean NOT NULL DEFAULT false, dispute_version bigint NOT NULL DEFAULT 0
);
CREATE INDEX referral_unsettled_checkouts ON public.referral_checkouts(email,created_at) WHERE state IN('prepared','observed');
CREATE TABLE public.referral_buyers(email text PRIMARY KEY,partner_id uuid REFERENCES public.referral_partners, first_order_id uuid NOT NULL UNIQUE REFERENCES public.referral_checkouts, next_sequence integer NOT NULL DEFAULT 1);
CREATE TABLE public.referral_earnings(
 order_id uuid PRIMARY KEY REFERENCES public.referral_checkouts, partner_id uuid NOT NULL REFERENCES public.referral_partners,
 email text NOT NULL REFERENCES public.referral_buyers, sequence integer NOT NULL CHECK(sequence>0), rate_bps integer NOT NULL CHECK(rate_bps IN(1000,500,200,100)),
 base_cents integer NOT NULL CHECK(base_cents>=0), original_cents integer NOT NULL CHECK(original_cents>=0),
 refunded_total_cents integer NOT NULL DEFAULT 0 CHECK(refunded_total_cents>=0), merchandise_refund_cents integer NOT NULL DEFAULT 0 CHECK(merchandise_refund_cents BETWEEN 0 AND base_cents),
 refund_review boolean NOT NULL DEFAULT false, disputed boolean NOT NULL DEFAULT false, dispute_version bigint NOT NULL DEFAULT 0,
 paid_at timestamptz NOT NULL, available_at timestamptz NOT NULL, UNIQUE(email,sequence)
);
CREATE TABLE public.referral_redemptions(
 id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES public.referral_partners, kind text NOT NULL CHECK(kind IN('check','product')),
 merchandise_cents integer NOT NULL CHECK(merchandise_cents>=0), shipping_cents integer NOT NULL CHECK(shipping_cents>=0), tax_cents integer NOT NULL CHECK(tax_cents>=0),
 total_cents integer NOT NULL CHECK(total_cents>0 AND total_cents=merchandise_cents+shipping_cents+tax_cents),
 notes text NOT NULL CHECK(length(notes) BETWEEN 1 AND 2000), state text NOT NULL DEFAULT 'requested' CHECK(state IN('requested','reserved','paid','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, completed_at timestamptz, reference text
);
CREATE TABLE public.referral_statements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_id uuid NOT NULL REFERENCES public.referral_partners,
 month text NOT NULL CHECK(month ~ '^\d{4}-\d{2}$'), balance jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(partner_id,month));
CREATE TABLE public.referral_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid,action text NOT NULL,entity_id text, details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
-- Nothing in this feature can be read or modified directly by browser roles.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['referral_settings','referral_partners','referral_invites','referral_checkouts','referral_buyers','referral_earnings','referral_redemptions','referral_statements','referral_audit'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',t);
 END LOOP; END $$;
GRANT USAGE,SELECT ON SEQUENCE public.referral_audit_id_seq TO service_role;
CREATE FUNCTION public.referral_balance(p_partner uuid,p_at timestamptz DEFAULT now()) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 WITH earned AS (SELECT
 coalesce(sum(original_cents),0)::bigint gross,
 coalesce(sum(original_cents-round((base_cents-merchandise_refund_cents)::numeric*rate_bps/10000)),0)::bigint reversed,
 coalesce(sum(CASE WHEN available_at>p_at AND NOT refund_review AND NOT disputed THEN round((base_cents-merchandise_refund_cents)::numeric*rate_bps/10000) ELSE 0 END),0)::bigint pending,
 coalesce(sum(CASE WHEN refund_review OR disputed THEN round((base_cents-merchandise_refund_cents)::numeric*rate_bps/10000) ELSE 0 END),0)::bigint held,
 coalesce(sum(CASE WHEN available_at<=p_at AND NOT refund_review AND NOT disputed THEN round((base_cents-merchandise_refund_cents)::numeric*rate_bps/10000) ELSE 0 END),0)::bigint vested
 FROM public.referral_earnings WHERE partner_id=p_partner), spent AS (
 SELECT coalesce(sum(total_cents) FILTER(WHERE state='reserved'),0)::bigint reserved,coalesce(sum(total_cents) FILTER(WHERE state='paid'),0)::bigint paid FROM public.referral_redemptions WHERE partner_id=p_partner)
 SELECT jsonb_build_object('gross',gross,'reversed',reversed,'pending',pending,'held',held,'reserved',reserved,'paid',paid,'available',vested-reserved-paid) FROM earned,spent;
$$;
-- These RPCs are service-only, SECURITY INVOKER, with no public execute grants.
CREATE FUNCTION public.referral_prepare(p_order uuid,p_email text,p_code text,p_merch integer,p_shipping integer,p_tax integer,p_params jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_email text:=lower(btrim(p_email)); v_partner uuid; v_checkout public.referral_checkouts; v_buyer public.referral_buyers; BEGIN
 IF coalesce(p_code,'')<>'' AND NOT coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Referral enrollment is unavailable'; END IF;
 IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(v_email)>254 THEN RAISE EXCEPTION 'Valid email required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_email,7221));
 SELECT * INTO v_checkout FROM public.referral_checkouts WHERE order_id=p_order;
 IF FOUND THEN
  IF v_checkout.state<>'prepared' OR v_checkout.email<>v_email OR v_checkout.intent_params<>p_params THEN RAISE EXCEPTION 'Checkout changed; start again'; END IF;
  RETURN to_jsonb(v_checkout);
 END IF;
 SELECT * INTO v_buyer FROM public.referral_buyers WHERE email=v_email;
 IF FOUND THEN
  v_partner:=v_buyer.partner_id;
  IF coalesce(p_code,'')<>'' THEN RAISE EXCEPTION 'Referral codes apply only to a first paid order'; END IF;
 ELSE
  IF coalesce(p_code,'')<>'' THEN
   IF EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(email))=v_email AND payment_status IN('paid','refunded','partially_refunded') AND id<>p_order) THEN RAISE EXCEPTION 'Referral codes apply only to a first paid order'; END IF;
   SELECT id INTO v_partner FROM public.referral_partners WHERE code=upper(btrim(p_code)) AND status='active' AND email<>v_email;
   IF v_partner IS NULL THEN RAISE EXCEPTION 'Referral code is unavailable for this email'; END IF;
  END IF;
 END IF;
 INSERT INTO public.referral_checkouts(order_id,email,partner_id,merchandise_cents,shipping_cents,tax_cents,total_cents,intent_params)
 VALUES(p_order,v_email,v_partner,p_merch,p_shipping,p_tax,p_merch+p_shipping+p_tax,p_params) RETURNING * INTO v_checkout;
 RETURN to_jsonb(v_checkout);
END; $$;
CREATE FUNCTION public.referral_attach(p_order uuid,p_intent text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.referral_checkouts SET intent_id=p_intent
 WHERE order_id=p_order AND state='prepared' AND (intent_id IS NULL OR intent_id=p_intent);
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout changed'; END IF;
END; $$;
-- Record authoritative payment observations first; sequence allocation happens only after reconciliation.
CREATE FUNCTION public.referral_paid(p_order uuid,p_intent text,p_email text,p_amount integer,p_paid timestamptz,p_verified boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.referral_checkouts; BEGIN
 SELECT * INTO c FROM public.referral_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.email,7221));
 SELECT * INTO c FROM public.referral_checkouts WHERE order_id=p_order FOR UPDATE;
 IF c.email<>lower(btrim(p_email)) OR c.total_cents<>p_amount OR (c.intent_id IS NOT NULL AND c.intent_id<>p_intent) THEN RAISE EXCEPTION 'Payment does not match checkout'; END IF;
 IF c.state='cancelled' OR p_paid IS NULL THEN RAISE EXCEPTION 'Payment requires review'; END IF;
 IF c.state='paid' THEN RETURN; END IF;
 UPDATE public.referral_checkouts SET intent_id=p_intent,state='observed',first_observed_at=coalesce(first_observed_at,clock_timestamp()),
 paid_at=CASE WHEN NOT paid_time_verified THEN p_paid ELSE paid_at END,
 paid_time_verified=paid_time_verified OR p_verified WHERE order_id=p_order;
END; $$;
CREATE FUNCTION public.referral_unpaid(p_order uuid,p_cancelled boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.referral_checkouts; BEGIN
 SELECT * INTO c FROM public.referral_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.email,7221));
 UPDATE public.referral_checkouts SET observed_unpaid_at=clock_timestamp(),state=CASE WHEN p_cancelled THEN 'cancelled' ELSE state END WHERE order_id=p_order AND state='prepared';
END; $$;
CREATE FUNCTION public.referral_reconcile(p_email text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.referral_checkouts; b public.referral_buyers; n integer; r integer; v_partner uuid; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_email,7221));
 FOR c IN SELECT * FROM public.referral_checkouts WHERE email=p_email AND state='observed' ORDER BY paid_at,order_id FOR UPDATE LOOP
  IF NOT c.paid_time_verified THEN RETURN; END IF;
  -- A prior unresolved intent might have paid earlier. Hold rewards only, never checkout or payment.
  IF EXISTS(SELECT 1 FROM public.referral_checkouts x WHERE x.email=p_email AND x.order_id<>c.order_id AND
   ((x.state='prepared' AND x.created_at<=least(c.first_observed_at,c.paid_at+interval '1 second') AND (x.observed_unpaid_at IS NULL OR x.observed_unpaid_at<c.paid_at)) OR
    (x.state='observed' AND NOT x.paid_time_verified AND x.created_at<=least(c.first_observed_at,c.paid_at+interval '1 second')))) THEN RETURN; END IF;
  SELECT * INTO b FROM public.referral_buyers WHERE email=p_email FOR UPDATE;
  IF NOT FOUND THEN
   v_partner:=c.partner_id;
   IF EXISTS(SELECT 1 FROM public.orders o WHERE lower(btrim(o.email))=p_email AND o.payment_status IN('paid','refunded','partially_refunded') AND o.id<>c.order_id AND NOT EXISTS(SELECT 1 FROM public.referral_checkouts x WHERE x.order_id=o.id)) THEN v_partner:=NULL; END IF;
   INSERT INTO public.referral_buyers(email,partner_id,first_order_id) VALUES(p_email,v_partner,c.order_id) RETURNING * INTO b;
  END IF;
  IF b.partner_id IS NOT NULL THEN
   PERFORM 1 FROM public.referral_partners WHERE id=b.partner_id FOR UPDATE;
   n:=b.next_sequence; r:=CASE WHEN n=1 THEN 1000 WHEN n=2 THEN 500 WHEN n<=10 THEN 200 ELSE 100 END;
   INSERT INTO public.referral_earnings(order_id,partner_id,email,sequence,rate_bps,base_cents,original_cents,paid_at,available_at,refunded_total_cents,merchandise_refund_cents,refund_review,disputed,dispute_version)
   VALUES(c.order_id,b.partner_id,p_email,n,r,c.merchandise_cents,round(c.merchandise_cents::numeric*r/10000),c.paid_at,c.paid_at+interval '7 days',c.refunded_total_cents,c.merchandise_refund_cents,c.refund_review,c.disputed,c.dispute_version);
   UPDATE public.referral_buyers SET next_sequence=next_sequence+1 WHERE email=p_email;
  END IF;
  UPDATE public.referral_checkouts SET state='paid' WHERE order_id=c.order_id;
  INSERT INTO public.referral_audit(action,entity_id,details) VALUES('verified_payment',c.order_id::text,jsonb_build_object('intent_id',c.intent_id,'paid_at',c.paid_at));
 END LOOP;
END; $$;
CREATE FUNCTION public.referral_adjust(p_intent text,p_refunded integer,p_disputed boolean,p_version bigint) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.referral_checkouts; e public.referral_earnings; BEGIN
 SELECT * INTO c FROM public.referral_checkouts WHERE intent_id=p_intent;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.email,7221));
 SELECT * INTO c FROM public.referral_checkouts WHERE intent_id=p_intent FOR UPDATE;
 IF p_refunded IS NULL OR p_refunded<0 OR p_refunded>c.total_cents THEN RAISE EXCEPTION 'Invalid refund'; END IF;
 SELECT * INTO e FROM public.referral_earnings WHERE order_id=c.order_id;
 IF FOUND THEN PERFORM 1 FROM public.referral_partners WHERE id=e.partner_id FOR UPDATE; END IF;
 IF p_refunded>c.refunded_total_cents OR (p_version>=c.dispute_version AND p_disputed IS DISTINCT FROM c.disputed) THEN
  INSERT INTO public.referral_audit(action,entity_id,details) VALUES('verified_adjustment',c.order_id::text,jsonb_build_object('intent_id',p_intent,'refunded_cents',p_refunded,'disputed',p_disputed,'event_version',p_version));
 END IF;
 UPDATE public.referral_checkouts SET refunded_total_cents=greatest(refunded_total_cents,p_refunded),
 merchandise_refund_cents=CASE WHEN p_refunded=total_cents THEN merchandise_cents ELSE merchandise_refund_cents END,
 refund_review=CASE WHEN p_refunded=total_cents THEN false WHEN p_refunded>refunded_total_cents THEN true ELSE refund_review END,
 disputed=CASE WHEN p_version>=dispute_version THEN p_disputed ELSE disputed END,dispute_version=greatest(dispute_version,p_version)
 WHERE order_id=c.order_id RETURNING * INTO c;
 UPDATE public.referral_earnings SET refunded_total_cents=c.refunded_total_cents,merchandise_refund_cents=c.merchandise_refund_cents,refund_review=c.refund_review,disputed=c.disputed,dispute_version=c.dispute_version WHERE order_id=c.order_id;
END; $$;
CREATE FUNCTION public.referral_signup(p_hash text,p_name text,p_address text,p_preference text) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE i public.referral_invites; p public.referral_partners; BEGIN
 IF NOT coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Referral enrollment is unavailable'; END IF;
 SELECT * INTO i FROM public.referral_invites WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR i.used_at IS NOT NULL OR i.expires_at<=now() THEN RAISE EXCEPTION 'Invitation is unavailable or expired'; END IF;
 IF p_name IS NULL OR p_address IS NULL OR p_preference NOT IN('check','product') OR p_preference IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR length(btrim(p_address)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Name, mailing address and reward preference required'; END IF;
 UPDATE public.referral_partners SET name=btrim(p_name),mailing_address=btrim(p_address),preference=p_preference,status='active',accepted_at=now() WHERE id=i.partner_id AND status='invited' RETURNING * INTO p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation is unavailable'; END IF;
 UPDATE public.referral_invites SET used_at=now() WHERE id=i.id;
 RETURN jsonb_build_object('code',p.code,'name',p.name);
END; $$;
CREATE FUNCTION public.referral_monthly(p_at timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF extract(day FROM p_at AT TIME ZONE 'America/Chicago')<>1 THEN RAISE EXCEPTION 'Monthly queue is prepared on the 1st in America/Chicago'; END IF;
 INSERT INTO public.referral_statements(partner_id,month,balance,created_at)
 SELECT id,to_char(p_at AT TIME ZONE 'America/Chicago','YYYY-MM'),public.referral_balance(id,p_at),p_at FROM public.referral_partners WHERE accepted_at IS NOT NULL ON CONFLICT(partner_id,month) DO NOTHING;
END; $$;
CREATE FUNCTION public.referral_admin(p_actor uuid,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p public.referral_partners; d public.referral_redemptions; e public.referral_earnings; c public.referral_checkouts; v_id uuid; v_total integer; v_balance jsonb; v_month text; BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
 RETURN jsonb_build_object('settings',(SELECT to_jsonb(s) FROM public.referral_settings s),
 'partners',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('balance',public.referral_balance(r.id)) ORDER BY r.created_at DESC) FROM public.referral_partners r),'[]'::jsonb),
 'unsettled',coalesce((SELECT jsonb_agg(jsonb_build_object('order_id',x.order_id,'email',x.email,'state',x.state,'paid_at',x.paid_at,'paid_time_verified',x.paid_time_verified) ORDER BY x.created_at) FROM public.referral_checkouts x WHERE state='observed'),'[]'::jsonb),
 'earnings',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY paid_at DESC) FROM public.referral_earnings x),'[]'::jsonb),
 'redemptions',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_at DESC) FROM public.referral_redemptions x),'[]'::jsonb),
 'statements',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_at DESC) FROM public.referral_statements x),'[]'::jsonb));
 ELSIF p_action='create' THEN
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(email))=lower(btrim(p_data->>'email')) AND payment_status='paid' AND coalesce(status,'') NOT IN('test','synthetic','cancelled')) THEN RAISE EXCEPTION 'Select an existing paid customer email'; END IF;
 INSERT INTO public.referral_partners(email,name,code) VALUES(lower(btrim(p_data->>'email')),btrim(p_data->>'name'),upper(btrim(p_data->>'code'))) RETURNING id INTO v_id;
 ELSIF p_action='invite' THEN
 SELECT * INTO p FROM public.referral_partners WHERE id=(p_data->>'partner_id')::uuid FOR UPDATE;
 IF NOT FOUND OR p.status<>'invited' THEN RAISE EXCEPTION 'Partner is not awaiting signup'; END IF;
 IF EXISTS(SELECT 1 FROM public.referral_invites WHERE partner_id=p.id AND used_at IS NULL AND expires_at>now()) THEN RAISE EXCEPTION 'Existing invitation requires delivery review or expiry'; END IF;
 INSERT INTO public.referral_invites(partner_id,token_hash,expires_at) VALUES(p.id,p_data->>'hash',now()+interval '7 days') RETURNING id INTO v_id;
 ELSIF p_action='status' THEN
 IF p_data->>'status' NOT IN('active','paused') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE public.referral_partners SET status=p_data->>'status' WHERE id=(p_data->>'partner_id')::uuid AND accepted_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Completed signup required'; END IF;
 ELSIF p_action='refund' THEN
 SELECT * INTO e FROM public.referral_earnings WHERE order_id=(p_data->>'order_id')::uuid;
 IF e.order_id IS NULL THEN RAISE EXCEPTION 'Earning missing'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(e.email,7221));
 PERFORM 1 FROM public.referral_partners WHERE id=e.partner_id FOR UPDATE;
 SELECT * INTO e FROM public.referral_earnings WHERE order_id=(p_data->>'order_id')::uuid FOR UPDATE;
 SELECT * INTO c FROM public.referral_checkouts WHERE order_id=e.order_id;
 v_total:=(p_data->>'merchandise_cents')::integer;
 IF e.order_id IS NULL OR NOT e.refund_review OR (p_data->>'refunded_total_cents')::integer IS DISTINCT FROM e.refunded_total_cents OR v_total IS NULL OR v_total<greatest(e.merchandise_refund_cents,e.refunded_total_cents-c.shipping_cents-c.tax_cents) OR v_total>least(e.base_cents,e.refunded_total_cents) THEN RAISE EXCEPTION 'Refund changed or allocation invalid; refresh'; END IF;
 UPDATE public.referral_checkouts SET merchandise_refund_cents=v_total,refund_review=false WHERE order_id=e.order_id;
 UPDATE public.referral_earnings SET merchandise_refund_cents=v_total,refund_review=false WHERE order_id=e.order_id;
 ELSIF p_action='request' THEN
 v_id:=(p_data->>'id')::uuid;
 PERFORM 1 FROM public.referral_partners WHERE id=(p_data->>'partner_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Partner missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.referral_redemptions WHERE id=v_id) THEN
 IF NOT EXISTS(SELECT 1 FROM public.referral_redemptions WHERE id=v_id AND partner_id=(p_data->>'partner_id')::uuid AND kind=p_data->>'kind' AND merchandise_cents=(p_data->>'merchandise_cents')::integer AND shipping_cents=(p_data->>'shipping_cents')::integer AND tax_cents=(p_data->>'tax_cents')::integer AND notes=p_data->>'notes') THEN RAISE EXCEPTION 'Request identity reused with different details'; END IF;
 RETURN jsonb_build_object('id',v_id); END IF;
 IF p_data->>'kind'='check' AND ((p_data->>'shipping_cents')::integer<>0 OR (p_data->>'tax_cents')::integer<>0) THEN RAISE EXCEPTION 'Checks have no product shipping or tax'; END IF;
 INSERT INTO public.referral_redemptions(id,partner_id,kind,merchandise_cents,shipping_cents,tax_cents,total_cents,notes)
 VALUES(v_id,(p_data->>'partner_id')::uuid,p_data->>'kind',(p_data->>'merchandise_cents')::integer,(p_data->>'shipping_cents')::integer,(p_data->>'tax_cents')::integer,
 (p_data->>'merchandise_cents')::integer+(p_data->>'shipping_cents')::integer+(p_data->>'tax_cents')::integer,p_data->>'notes');
 ELSIF p_action IN('approve','reject','complete') THEN
 SELECT * INTO d FROM public.referral_redemptions WHERE id=(p_data->>'id')::uuid;
 PERFORM 1 FROM public.referral_partners WHERE id=d.partner_id FOR UPDATE;
 SELECT * INTO d FROM public.referral_redemptions WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Request missing'; END IF;
 v_balance:=public.referral_balance(d.partner_id);
 IF p_action='approve' THEN
 IF d.state IN('reserved','paid') THEN RETURN to_jsonb(d); END IF;
 IF d.state<>'requested' OR (v_balance->>'available')::bigint<d.total_cents THEN RAISE EXCEPTION 'Insufficient available rewards or request changed'; END IF;
 UPDATE public.referral_redemptions SET state='reserved',approved_at=now() WHERE id=d.id;
 ELSIF p_action='complete' THEN
 IF d.state='paid' THEN RETURN to_jsonb(d); END IF;
 IF d.state<>'reserved' OR (v_balance->>'available')::bigint<0 OR length(btrim(coalesce(p_data->>'reference',''))) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Available balance changed or issuance reference missing'; END IF;
 UPDATE public.referral_redemptions SET state='paid',completed_at=now(),reference=p_data->>'reference' WHERE id=d.id;
 ELSE
 IF d.state='paid' THEN RAISE EXCEPTION 'Issued rewards cannot be rejected'; END IF;
 UPDATE public.referral_redemptions SET state='rejected' WHERE id=d.id;
 END IF;
 ELSIF p_action='month' THEN
 PERFORM public.referral_monthly();
 ELSE RAISE EXCEPTION 'Unknown referral action'; END IF;
 INSERT INTO public.referral_audit(actor_id,action,entity_id,details) VALUES(p_actor,p_action,coalesce(v_id::text,p_data->>'id',p_data->>'order_id',p_data->>'partner_id'),p_data-'hash'-'email'-'name'-'notes'-'reference');
 RETURN jsonb_build_object('id',v_id);
END; $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'referral_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
 END LOOP; END $$;
COMMIT;
