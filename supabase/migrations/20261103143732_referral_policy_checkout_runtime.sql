-- LOCAL STAGED ONLY. No activation, grants cutover, schedules, emails or provider operations.
-- Requires the reviewed v2 frontend/backend together before referral activation.
BEGIN;
ALTER TABLE public.checkout_requests ADD COLUMN cancelled_at timestamptz, ADD COLUMN first_order_coordinated boolean NOT NULL DEFAULT false;
CREATE TABLE public.checkout_cancellations(id uuid PRIMARY KEY,capability_hash text NOT NULL CHECK(capability_hash ~ '^[a-f0-9]{64}$'),requested_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE public.checkout_cancellations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_cancellations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.checkout_cancellations TO service_role;
CREATE TABLE public.referral_first_checkouts(email text PRIMARY KEY CHECK(email=lower(btrim(email))),checkout_id uuid NOT NULL UNIQUE REFERENCES public.checkout_requests,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE public.referral_first_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_first_checkouts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.referral_first_checkouts TO service_role;
ALTER TABLE public.referral_earnings DROP CONSTRAINT referral_earnings_rate_bps_check;
ALTER TABLE public.referral_earnings ADD CONSTRAINT referral_earnings_rate_bps_check CHECK(rate_bps BETWEEN 0 AND 10000), ADD COLUMN policy_snapshot jsonb;
ALTER TABLE public.referral_checkouts ADD COLUMN policy_snapshot jsonb;
-- Existing transactions retain their originally promised rates, including already prepared orders.
UPDATE public.referral_checkouts SET policy_snapshot=jsonb_build_object('partner_id',partner_id,'revision',0,'legacy',true,'buyer_discount_bps',0,'tiers',jsonb_build_array(jsonb_build_object('through',1,'bps',1000),jsonb_build_object('through',2,'bps',500),jsonb_build_object('through',10,'bps',200),jsonb_build_object('through',2147483647,'bps',100)));
UPDATE public.referral_earnings e SET policy_snapshot=jsonb_set(c.policy_snapshot,'{partner_id}',to_jsonb(e.partner_id::text)) FROM public.referral_checkouts c WHERE c.order_id=e.order_id;
CREATE FUNCTION public.referral_policy_rate(p_sequence integer,p_tiers jsonb) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_sequence>0 AND public.referral_valid_tiers(p_tiers) THEN coalesce((SELECT (t->>'bps')::integer FROM jsonb_array_elements(p_tiers) WITH ORDINALITY a(t,n) WHERE p_sequence<=(t->>'through')::integer ORDER BY n LIMIT 1),0) ELSE 0 END;
$$;
CREATE FUNCTION public.referral_quote_code(p_email text,p_code text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE email_key text:=lower(btrim(p_email)); code_key text:=upper(btrim(coalesce(p_code,''))); partner public.referral_partners;
BEGIN
 IF code_key<>'' THEN
  IF email_key IS NULL OR email_key !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(email_key)>254 THEN RAISE EXCEPTION 'Enter your email to verify this code'; END IF;
  IF NOT coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Referral codes are unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.referral_buyers WHERE email=email_key) OR EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(email))=email_key AND payment_status IN('paid','refunded','partially_refunded')) THEN RAISE EXCEPTION 'Referral codes apply only to a first paid order'; END IF;
  SELECT * INTO partner FROM public.referral_partners WHERE code=code_key AND status='active' AND email<>email_key FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Referral code is unavailable for this email'; END IF;
 ELSE
  SELECT p.* INTO partner FROM public.referral_buyers b JOIN public.referral_partners p ON p.id=b.partner_id WHERE b.email=email_key FOR SHARE OF p;
  IF NOT FOUND THEN RETURN NULL; END IF;
 END IF;
 RETURN jsonb_build_object('partner_id',partner.id,'revision',partner.policy_revision,'buyer_discount_bps',partner.buyer_discount_bps,'tiers',partner.commission_tiers);
END; $$;
CREATE FUNCTION public.referral_validate_checkout(p_id uuid,p_order jsonb,p_params jsonb) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
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
 IF EXISTS(SELECT 1 FROM public.orders o LEFT JOIN public.checkout_requests c ON c.order_id=o.id WHERE lower(btrim(o.email))=email_key AND (coalesce(o.payment_method,'stripe')='stripe' OR nullif(o.stripe_payment_intent_id,'') IS NOT NULL OR c.id IS NOT NULL) AND coalesce(o.payment_status,'') NOT IN('paid','refunded','partially_refunded') AND (c.id IS NULL OR (NOT c.first_order_coordinated AND c.cancelled_at IS NULL))) THEN RAISE EXCEPTION 'An earlier payment needs verification before another first order. Resume it or contact us'; END IF;
 RETURN true;
END; $$;
CREATE FUNCTION public.request_checkout_cancellation(p_id uuid,p_capability_hash text) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.checkout_requests; old_hash text;
BEGIN
 -- ID lock only. Never acquire an email/row lock while holding this lock.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,8171));
 SELECT * INTO c FROM public.checkout_requests WHERE id=p_id;
 IF FOUND AND c.capability_hash IS DISTINCT FROM p_capability_hash THEN RAISE EXCEPTION 'Checkout cancellation unavailable'; END IF;
 SELECT capability_hash INTO old_hash FROM public.checkout_cancellations WHERE id=p_id;
 IF FOUND AND old_hash IS DISTINCT FROM p_capability_hash THEN RAISE EXCEPTION 'Checkout cancellation unavailable'; END IF;
 INSERT INTO public.checkout_cancellations(id,capability_hash) VALUES(p_id,p_capability_hash) ON CONFLICT(id) DO NOTHING;
 RETURN CASE WHEN c.id IS NULL THEN NULL ELSE to_jsonb(c) END;
END; $$;
CREATE FUNCTION public.assert_checkout_open(p_id uuid,p_capability_hash text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.checkout_requests WHERE id=p_id AND capability_hash=p_capability_hash AND cancelled_at IS NULL) THEN RAISE EXCEPTION 'Checkout unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.checkout_cancellations WHERE id=p_id) THEN RAISE EXCEPTION 'This checkout was cancelled or cancellation is pending. Review its status before paying'; END IF;
END; $$;
CREATE FUNCTION public.referral_first_checkout_list(p_actor uuid,p_email text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE rows jsonb; more boolean;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_email IS NOT NULL AND (length(p_email)>254 OR lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Enter the exact customer email'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows FROM (SELECT email,checkout_id,created_at FROM public.referral_first_checkouts WHERE p_email IS NULL OR email=lower(btrim(p_email)) ORDER BY created_at,checkout_id LIMIT 200) r;
 SELECT EXISTS(SELECT 1 FROM public.referral_first_checkouts WHERE p_email IS NULL OR email=lower(btrim(p_email)) ORDER BY created_at,checkout_id OFFSET 200 LIMIT 1) INTO more;
 RETURN jsonb_build_object('rows',rows,'has_more',more);
END; $$;
CREATE FUNCTION public.referral_admin_cancel_request(p_actor uuid,p_checkout uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.checkout_requests; result jsonb;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.checkout_requests WHERE id=p_checkout;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout unavailable'; END IF;
 result:=public.request_checkout_cancellation(p_checkout,c.capability_hash);
 INSERT INTO public.referral_audit(actor_id,action,entity_id,details) VALUES(p_actor,'checkout_cancel_requested',p_checkout::text,'{}');
 RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.prepare_secure_checkout(p_id uuid,p_capability_hash text,p_fingerprint text,p_order jsonb,p_params jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.checkout_requests; v_order uuid:=gen_random_uuid(); coordinated boolean:=false; v_email text:=lower(btrim(p_order->>'email')); BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(v_email,7221));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,8171));
 IF EXISTS(SELECT 1 FROM public.checkout_cancellations WHERE id=p_id) THEN RAISE EXCEPTION 'This checkout was cancelled or cancellation is pending. Start a new checkout only after cancellation is confirmed'; END IF;
 SELECT * INTO r FROM public.checkout_requests WHERE id=p_id;
 IF FOUND THEN
  IF r.capability_hash<>p_capability_hash OR r.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'Checkout capability or details changed'; END IF;
  IF r.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'This checkout was cancelled. Start a new checkout'; END IF;
  RETURN to_jsonb(r);
 END IF;
 IF p_order IS NULL OR p_params IS NULL OR (p_order->>'total_cents')::integer<>((p_order->>'subtotal_cents')::integer-(p_order->>'discount_cents')::integer+(p_order->>'shipping_cents')::integer+(p_order->>'tax_cents')::integer)
 OR (p_order->>'total_cents')::integer<1 OR (p_params->>'amount')::integer IS DISTINCT FROM (p_order->>'total_cents')::integer OR p_params->>'currency'<>'usd' THEN RAISE EXCEPTION 'Invalid trusted checkout'; END IF;
 coordinated:=public.referral_validate_checkout(p_id,p_order,p_params);
 INSERT INTO public.orders(id,email,name,company,phone,shipping_address,items,subtotal_cents,discount_cents,discount_reason,discount_code,shipping_cents,tax_cents,stripe_tax_calculation_id,total_cents,how_heard,status,payment_status,payment_method)
 VALUES(v_order,p_order->>'email',p_order->>'name',p_order->>'company',p_order->>'phone',p_order->'shipping_address',p_order->'items',(p_order->>'subtotal_cents')::integer,(p_order->>'discount_cents')::integer,p_order->>'discount_reason',p_order->>'discount_code',(p_order->>'shipping_cents')::integer,(p_order->>'tax_cents')::integer,p_order->>'stripe_tax_calculation_id',(p_order->>'total_cents')::integer,p_order->>'how_heard','pending','pending','stripe');
 p_params:=jsonb_set(p_params,'{metadata,order_id}',to_jsonb(v_order::text));
 p_params:=jsonb_set(p_params,'{metadata,secure_checkout_id}',to_jsonb(p_id::text));
 INSERT INTO public.checkout_requests(id,capability_hash,fingerprint,order_id,order_snapshot,intent_params) VALUES(p_id,p_capability_hash,p_fingerprint,v_order,p_order,p_params) RETURNING * INTO r;
 UPDATE public.checkout_requests SET first_order_coordinated=coordinated WHERE id=p_id RETURNING * INTO r;
 IF coordinated THEN INSERT INTO public.referral_first_checkouts(email,checkout_id) VALUES(v_email,p_id); END IF;
 RETURN to_jsonb(r);
END; $$;

CREATE OR REPLACE FUNCTION public.attach_secure_checkout(p_id uuid,p_intent text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.checkout_requests; BEGIN
 SELECT * INTO r FROM public.checkout_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.cancelled_at IS NOT NULL OR (r.intent_id IS NOT NULL AND r.intent_id<>p_intent) THEN RAISE EXCEPTION 'Checkout binding changed'; END IF;
 UPDATE public.checkout_requests SET intent_id=p_intent WHERE id=p_id;
 UPDATE public.orders SET stripe_payment_intent_id=p_intent WHERE id=r.order_id AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id=p_intent);
 IF NOT FOUND THEN RAISE EXCEPTION 'Order payment binding changed'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_verified_order_payment(p_order uuid,p_intent text,p_amount integer,p_currency text,p_email text,p_checkout uuid DEFAULT NULL,p_succeeded boolean DEFAULT true,p_items jsonb DEFAULT NULL,p_tax_calculation text DEFAULT NULL,p_financial jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE o public.orders; c public.checkout_requests; receipt public.order_payment_receipts; trusted jsonb; tax_id text; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)),7221));
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment order unavailable'; END IF;
 SELECT * INTO c FROM public.checkout_requests WHERE order_id=p_order;
 IF FOUND THEN
  IF p_checkout IS DISTINCT FROM c.id OR c.intent_id IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'Payment binding mismatch'; END IF;
  IF c.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Cancelled checkout payment requires review'; END IF;
  trusted:=c.order_snapshot;
  IF coalesce(p_tax_calculation,'')<>coalesce(trusted->>'stripe_tax_calculation_id','') THEN RAISE EXCEPTION 'Payment tax binding mismatch'; END IF;
 ELSE
  -- Legacy return tabs may reconcile only a matching real Stripe payment after capability verification.
  IF p_checkout IS NOT NULL OR o.payment_method IS DISTINCT FROM 'stripe' THEN RAISE EXCEPTION 'Legacy payment requires review'; END IF;
  trusted:=to_jsonb(o);
  IF p_items IS NULL OR (SELECT jsonb_agg(jsonb_build_object('productId',x->>'productId','quantity',(x->>'quantity')::integer) ORDER BY x->>'productId') FROM jsonb_array_elements(o.items)x) IS DISTINCT FROM (SELECT jsonb_agg(x ORDER BY x->>'productId') FROM jsonb_array_elements(p_items)x) THEN RAISE EXCEPTION 'Legacy order items require review'; END IF;
 END IF;
 IF p_succeeded IS NULL THEN RAISE EXCEPTION 'Payment status required'; END IF;
 IF p_currency IS DISTINCT FROM 'usd' OR p_amount IS DISTINCT FROM (trusted->>'total_cents')::integer
 OR lower(btrim(p_email)) IS DISTINCT FROM lower(btrim(trusted->>'email')) OR
 (o.stripe_payment_intent_id IS NOT NULL AND o.stripe_payment_intent_id<>p_intent) THEN RAISE EXCEPTION 'Payment amount or identity mismatch'; END IF;
 IF c.id IS NULL AND p_succeeded THEN
  -- Already fulfilled old returns can display their verified payment without historical backfill or tax writes.
  IF o.payment_status='paid' AND o.stock_decremented IS TRUE AND o.stripe_payment_intent_id=p_intent THEN RETURN jsonb_build_object('status','paid','legacy_existing',true); END IF;
  IF p_financial IS NULL OR o.subtotal_cents IS DISTINCT FROM (p_financial->>'s')::integer OR coalesce(o.discount_cents,0) IS DISTINCT FROM (p_financial->>'d')::integer OR o.shipping_cents IS DISTINCT FROM (p_financial->>'h')::integer OR coalesce(o.tax_cents,0) IS DISTINCT FROM (p_financial->>'t')::integer OR
  (SELECT jsonb_agg(jsonb_build_array(x->>'productId',(x->>'quantity')::integer,(x->>'price')::integer) ORDER BY x->>'productId') FROM jsonb_array_elements(o.items)x) IS DISTINCT FROM
  (SELECT jsonb_agg(jsonb_build_array(x->>0,(x->>1)::integer,(x->>2)::integer) ORDER BY x->>0) FROM jsonb_array_elements(p_financial->'i')x) THEN RAISE EXCEPTION 'Legacy financial snapshot requires owner review'; END IF;
 END IF;
 IF c.id IS NOT NULL AND (o.total_cents IS DISTINCT FROM (trusted->>'total_cents')::integer OR lower(btrim(o.email)) IS DISTINCT FROM lower(btrim(trusted->>'email')) OR o.items IS DISTINCT FROM trusted->'items' OR o.subtotal_cents IS DISTINCT FROM (trusted->>'subtotal_cents')::integer OR coalesce(o.discount_cents,0) IS DISTINCT FROM (trusted->>'discount_cents')::integer OR o.shipping_cents IS DISTINCT FROM (trusted->>'shipping_cents')::integer OR coalesce(o.tax_cents,0) IS DISTINCT FROM (trusted->>'tax_cents')::integer OR o.shipping_address IS DISTINCT FROM trusted->'shipping_address') THEN RAISE EXCEPTION 'Order details changed after checkout'; END IF;
 IF NOT p_succeeded THEN
  UPDATE public.orders SET payment_status='failed',updated_at=now() WHERE id=p_order AND payment_status IS DISTINCT FROM 'paid';
  RETURN jsonb_build_object('status','failed');
 END IF;
 SELECT * INTO receipt FROM public.order_payment_receipts WHERE order_id=p_order;
 IF FOUND THEN
  IF receipt.intent_id<>p_intent OR receipt.amount_cents<>p_amount THEN RAISE EXCEPTION 'Paid order binding changed'; END IF;
  RETURN jsonb_build_object('status','paid','tax_state',receipt.tax_state);
 END IF;
 tax_id:=CASE WHEN c.id IS NOT NULL THEN trusted->>'stripe_tax_calculation_id' ELSE p_tax_calculation END;
 INSERT INTO public.order_payment_receipts(order_id,intent_id,amount_cents,tax_calculation_id,tax_state,tax_transaction_id)
 VALUES(p_order,p_intent,p_amount,tax_id,CASE WHEN coalesce(tax_id,'')='' AND o.stripe_tax_transaction_id IS NULL THEN 'not_required' WHEN c.id IS NULL OR o.stripe_tax_transaction_id IS NOT NULL THEN 'review' ELSE 'pending' END,NULL);
 UPDATE public.orders SET payment_status='paid',status=CASE WHEN status IN('pending','') OR status IS NULL THEN 'confirmed' ELSE status END,
 stripe_payment_intent_id=p_intent,updated_at=now() WHERE id=p_order;
 IF trusted->>'discount_code' IN('WELCOME5','COMEBACK5') THEN
  INSERT INTO public.discount_redemptions(code,email,order_id) VALUES(trusted->>'discount_code',lower(btrim(trusted->>'email')),p_order) ON CONFLICT(code,email) DO NOTHING;
 END IF;
 DELETE FROM public.referral_first_checkouts WHERE checkout_id=c.id;
 RETURN jsonb_build_object('status','paid');
END; $$;

CREATE OR REPLACE FUNCTION public.referral_prepare(p_order uuid,p_email text,p_code text,p_merch integer,p_shipping integer,p_tax integer,p_params jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_email text:=lower(btrim(p_email)); v_partner uuid; v_checkout public.referral_checkouts; v_buyer public.referral_buyers; policy jsonb; partner public.referral_partners; BEGIN
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
 IF v_partner IS NOT NULL THEN
  SELECT order_snapshot->'referral_policy' INTO policy FROM public.checkout_requests WHERE order_id=p_order;
  IF policy IS NULL OR policy='null'::jsonb THEN
   SELECT * INTO partner FROM public.referral_partners WHERE id=v_partner FOR SHARE;
   policy:=jsonb_build_object('partner_id',partner.id,'revision',partner.policy_revision,'buyer_discount_bps',partner.buyer_discount_bps,'tiers',partner.commission_tiers);
  END IF;
  IF policy->>'partner_id' IS DISTINCT FROM v_partner::text OR NOT public.referral_valid_tiers(policy->'tiers') THEN RAISE EXCEPTION 'Code policy snapshot mismatch'; END IF;
  UPDATE public.referral_checkouts SET policy_snapshot=policy WHERE order_id=p_order RETURNING * INTO v_checkout;
 END IF;
 RETURN to_jsonb(v_checkout);
END; $$;

CREATE OR REPLACE FUNCTION public.referral_reconcile(p_email text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.referral_checkouts; b public.referral_buyers; n integer; r integer; v_partner uuid; policy jsonb; BEGIN
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
   IF c.partner_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.orders o WHERE lower(btrim(o.email))=p_email AND o.payment_status IN('paid','refunded','partially_refunded') AND o.id<>c.order_id AND NOT EXISTS(SELECT 1 FROM public.referral_checkouts x WHERE x.order_id=o.id)) THEN
    -- A newly paid legacy/non-referral checkout has no immutable referral paid-time proof.
    -- Hold rather than permanently disqualifying a potentially earlier code-bearing payment.
    RETURN;
   END IF;
   INSERT INTO public.referral_buyers(email,partner_id,first_order_id) VALUES(p_email,v_partner,c.order_id) RETURNING * INTO b;
  END IF;
  IF b.partner_id IS NOT NULL THEN
   PERFORM 1 FROM public.referral_partners WHERE id=b.partner_id FOR UPDATE;
   n:=b.next_sequence; policy:=c.policy_snapshot;
   IF policy->>'legacy'='true' THEN policy:=jsonb_set(policy,'{partner_id}',to_jsonb(b.partner_id::text)); END IF;
   IF policy->>'partner_id' IS DISTINCT FROM b.partner_id::text THEN
    -- Only legacy/uncoordinated checkouts can have a different tentative partner.
    -- Use immutable terms in force when that order was prepared, or hold rather than guess.
    SELECT jsonb_build_object('partner_id',v.partner_id,'revision',v.revision,'buyer_discount_bps',v.buyer_discount_bps,'tiers',v.commission_tiers)
     INTO policy FROM public.referral_policy_versions v WHERE v.partner_id=b.partner_id AND v.created_at<=c.created_at ORDER BY v.revision DESC LIMIT 1;
    IF policy IS NULL THEN RETURN; END IF;
   END IF;
   r:=public.referral_policy_rate(n,policy->'tiers');
   INSERT INTO public.referral_earnings(order_id,partner_id,email,sequence,rate_bps,base_cents,original_cents,paid_at,available_at,refunded_total_cents,merchandise_refund_cents,refund_review,disputed,dispute_version,policy_snapshot)
   VALUES(c.order_id,b.partner_id,p_email,n,r,c.merchandise_cents,round(c.merchandise_cents::numeric*r/10000),c.paid_at,c.paid_at+interval '7 days',c.refunded_total_cents,c.merchandise_refund_cents,c.refund_review,c.disputed,c.dispute_version,policy);
   UPDATE public.referral_buyers SET next_sequence=next_sequence+1 WHERE email=p_email;
  END IF;
  UPDATE public.referral_checkouts SET state='paid' WHERE order_id=c.order_id;
  INSERT INTO public.referral_audit(action,entity_id,details) VALUES('verified_payment',c.order_id::text,jsonb_build_object('intent_id',c.intent_id,'paid_at',c.paid_at));
 END LOOP;
END; $$;
CREATE FUNCTION public.cancel_secure_checkout(p_id uuid,p_capability_hash text,p_intent text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.checkout_requests; email_key text;
BEGIN
 SELECT order_snapshot->>'email' INTO email_key FROM public.checkout_requests WHERE id=p_id;
 PERFORM pg_advisory_xact_lock(hashtextextended(email_key,7221));
 SELECT * INTO c FROM public.checkout_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.capability_hash IS DISTINCT FROM p_capability_hash OR (c.intent_id IS NOT NULL AND c.intent_id IS DISTINCT FROM p_intent) OR p_intent IS NULL THEN RAISE EXCEPTION 'Checkout cancellation unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.order_payment_receipts WHERE order_id=c.order_id) OR EXISTS(SELECT 1 FROM public.orders WHERE id=c.order_id AND payment_status IN('paid','refunded','partially_refunded')) THEN RAISE EXCEPTION 'A paid checkout cannot be cancelled here'; END IF;
 -- Service calls only after retrieving the authoritative provider status `canceled`.
 UPDATE public.checkout_requests SET intent_id=p_intent,cancelled_at=coalesce(cancelled_at,clock_timestamp()) WHERE id=p_id;
 UPDATE public.referral_checkouts SET intent_id=p_intent,state='cancelled' WHERE order_id=c.order_id AND state='prepared';
 UPDATE public.orders SET status='cancelled',payment_status='failed',stripe_payment_intent_id=p_intent WHERE id=c.order_id;
 DELETE FROM public.referral_first_checkouts WHERE checkout_id=p_id;
END; $$;
CREATE FUNCTION public.referral_invite_preview(p_hash text) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE partner public.referral_partners;
BEGIN
 IF NOT coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 SELECT p.* INTO partner FROM public.referral_invites i JOIN public.referral_partners p ON p.id=i.partner_id WHERE i.token_hash=p_hash AND i.used_at IS NULL AND i.expires_at>now() AND p.status='invited';
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 RETURN jsonb_build_object('code',partner.code,'revision',partner.policy_revision,'buyer_discount_bps',partner.buyer_discount_bps,'tiers',partner.commission_tiers);
END; $$;
CREATE FUNCTION public.referral_signup_policy(p_hash text,p_name text,p_address text,p_preference text,p_revision integer) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE invite public.referral_invites; partner public.referral_partners;
BEGIN
 SELECT * INTO invite FROM public.referral_invites WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR invite.used_at IS NOT NULL OR invite.expires_at<=now() THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 SELECT * INTO partner FROM public.referral_partners WHERE id=invite.partner_id FOR UPDATE;
 IF p_revision IS NULL OR partner.policy_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Code settings changed. Review the current terms before accepting'; END IF;
 RETURN public.referral_signup(p_hash,p_name,p_address,p_preference);
END; $$;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('referral_first_checkout_list','request_checkout_cancellation','assert_checkout_open','referral_admin_cancel_request','referral_policy_rate','referral_quote_code','referral_validate_checkout','prepare_secure_checkout','attach_secure_checkout','apply_verified_order_payment','referral_prepare','referral_reconcile','cancel_secure_checkout','referral_invite_preview','referral_signup_policy') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
END LOOP; END $$;
COMMIT;
