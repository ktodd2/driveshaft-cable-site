-- STAGED additive service schema. No order backfill, grants cutover, schedules or live operations.
BEGIN;
CREATE TABLE public.checkout_requests(
 id uuid PRIMARY KEY,capability_hash text NOT NULL CHECK(capability_hash ~ '^[0-9a-f]{64}$'),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),order_id uuid NOT NULL UNIQUE REFERENCES public.orders,
 order_snapshot jsonb NOT NULL,intent_params jsonb NOT NULL,intent_id text UNIQUE,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_payment_receipts(
 order_id uuid PRIMARY KEY REFERENCES public.orders,intent_id text NOT NULL UNIQUE,amount_cents integer NOT NULL CHECK(amount_cents>0),
 paid_at timestamptz NOT NULL DEFAULT now(),tax_calculation_id text,tax_state text NOT NULL CHECK(tax_state IN('not_required','pending','processing','accepted','review')),
 tax_started_at timestamptz,tax_transaction_id text,tax_reason text
);
ALTER TABLE public.checkout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payment_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_requests,public.order_payment_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.checkout_requests,public.order_payment_receipts TO service_role;
CREATE INDEX IF NOT EXISTS orders_normalized_paid_email ON public.orders((lower(btrim(email)))) WHERE payment_status='paid';
CREATE FUNCTION public.checkout_repeat_customer(p_email text) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(email))=lower(btrim(p_email)) AND payment_status='paid');
$$;
CREATE FUNCTION public.prepare_secure_checkout(p_id uuid,p_capability_hash text,p_fingerprint text,p_order jsonb,p_params jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.checkout_requests; v_order uuid:=gen_random_uuid(); BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,8171));
 SELECT * INTO r FROM public.checkout_requests WHERE id=p_id;
 IF FOUND THEN
  IF r.capability_hash<>p_capability_hash OR r.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'Checkout capability or details changed'; END IF;
  RETURN to_jsonb(r);
 END IF;
 IF p_order IS NULL OR p_params IS NULL OR (p_order->>'total_cents')::integer<>((p_order->>'subtotal_cents')::integer-(p_order->>'discount_cents')::integer+(p_order->>'shipping_cents')::integer+(p_order->>'tax_cents')::integer)
 OR (p_order->>'total_cents')::integer<1 OR (p_params->>'amount')::integer IS DISTINCT FROM (p_order->>'total_cents')::integer OR p_params->>'currency'<>'usd' THEN RAISE EXCEPTION 'Invalid trusted checkout'; END IF;
 INSERT INTO public.orders(id,email,name,company,phone,shipping_address,items,subtotal_cents,discount_cents,discount_reason,discount_code,shipping_cents,tax_cents,stripe_tax_calculation_id,total_cents,how_heard,status,payment_status,payment_method)
 VALUES(v_order,p_order->>'email',p_order->>'name',p_order->>'company',p_order->>'phone',p_order->'shipping_address',p_order->'items',(p_order->>'subtotal_cents')::integer,(p_order->>'discount_cents')::integer,p_order->>'discount_reason',p_order->>'discount_code',(p_order->>'shipping_cents')::integer,(p_order->>'tax_cents')::integer,p_order->>'stripe_tax_calculation_id',(p_order->>'total_cents')::integer,p_order->>'how_heard','pending','pending','stripe');
 p_params:=jsonb_set(p_params,'{metadata,order_id}',to_jsonb(v_order::text));
 p_params:=jsonb_set(p_params,'{metadata,secure_checkout_id}',to_jsonb(p_id::text));
 INSERT INTO public.checkout_requests(id,capability_hash,fingerprint,order_id,order_snapshot,intent_params) VALUES(p_id,p_capability_hash,p_fingerprint,v_order,p_order,p_params) RETURNING * INTO r;
 RETURN to_jsonb(r);
END; $$;
CREATE FUNCTION public.attach_secure_checkout(p_id uuid,p_intent text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.checkout_requests; BEGIN
 SELECT * INTO r FROM public.checkout_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR (r.intent_id IS NOT NULL AND r.intent_id<>p_intent) THEN RAISE EXCEPTION 'Checkout binding changed'; END IF;
 UPDATE public.checkout_requests SET intent_id=p_intent WHERE id=p_id;
 UPDATE public.orders SET stripe_payment_intent_id=p_intent WHERE id=r.order_id AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id=p_intent);
 IF NOT FOUND THEN RAISE EXCEPTION 'Order payment binding changed'; END IF;
END; $$;
CREATE FUNCTION public.apply_verified_order_payment(p_order uuid,p_intent text,p_amount integer,p_currency text,p_email text,p_checkout uuid DEFAULT NULL,p_succeeded boolean DEFAULT true,p_items jsonb DEFAULT NULL,p_tax_calculation text DEFAULT NULL,p_financial jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE o public.orders; c public.checkout_requests; receipt public.order_payment_receipts; trusted jsonb; tax_id text; BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment order unavailable'; END IF;
 SELECT * INTO c FROM public.checkout_requests WHERE order_id=p_order;
 IF FOUND THEN
  IF p_checkout IS DISTINCT FROM c.id OR c.intent_id IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'Payment binding mismatch'; END IF;
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
 RETURN jsonb_build_object('status','paid');
END; $$;
CREATE FUNCTION public.claim_order_tax(p_order uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.order_payment_receipts; BEGIN
 UPDATE public.order_payment_receipts SET tax_state='processing',tax_started_at=now() WHERE order_id=p_order AND tax_state='pending' RETURNING * INTO r;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('calculation_id',r.tax_calculation_id,'reference',p_order::text);
END; $$;
CREATE FUNCTION public.record_order_tax(p_order uuid,p_transaction text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.order_payment_receipts SET tax_state=CASE WHEN p_transaction IS NULL THEN 'review' ELSE 'accepted' END,
 tax_transaction_id=p_transaction,tax_reason=CASE WHEN p_transaction IS NULL THEN 'provider_or_storage_outcome_requires_review' ELSE NULL END WHERE order_id=p_order AND tax_state='processing';
 IF NOT FOUND THEN RAISE EXCEPTION 'Tax reconciliation changed'; END IF;
 IF p_transaction IS NOT NULL AND length(btrim(p_transaction)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid tax transaction'; END IF;
 IF p_transaction IS NOT NULL THEN UPDATE public.orders SET stripe_tax_transaction_id=p_transaction WHERE id=p_order; END IF;
END; $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('prepare_secure_checkout','attach_secure_checkout','apply_verified_order_payment','claim_order_tax','record_order_tax','checkout_repeat_customer') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
 END LOOP; END $$;
COMMIT;
