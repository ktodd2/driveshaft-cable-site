-- Admin-only bounded customer lookup. No customer enrollment, emails or order mutation.
-- Legacy payment flags are authoritative history here; known test markers are excluded,
-- but this does not independently re-verify old Stripe payments.
BEGIN;
CREATE FUNCTION public.referral_eligible_past_order(p_email text,p_payment_status text,p_status text,p_method text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT coalesce(length(btrim(p_email))<=254 AND btrim(p_email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 AND lower(btrim(p_payment_status)) IN('paid','refunded','partially_refunded')
 AND lower(btrim(coalesce(p_status,''))) NOT IN('test','synthetic')
 AND lower(btrim(coalesce(p_method,''))) NOT IN('test','synthetic','stripe_test')
 AND split_part(lower(btrim(p_email)),'@',2) NOT IN('localhost','example.com','example.net','example.org')
 AND split_part(lower(btrim(p_email)),'@',2) !~ '(^|\.)(invalid|test|example|localhost|example\.com|example\.net|example\.org)$',false);
$$;
CREATE FUNCTION public.referral_past_customer_search(p_actor uuid,p_query text DEFAULT '',p_after text DEFAULT NULL,p_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE query_key text:=lower(btrim(coalesce(p_query,''))); after_key text:=nullif(lower(btrim(p_after)),''); answer jsonb;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active IS TRUE) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF length(query_key)>254 OR length(coalesce(after_key,''))>254 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid customer search'; END IF;
 WITH customers AS (
  SELECT DISTINCT ON(lower(btrim(o.email))) lower(btrim(o.email)) customer_email,
   left(coalesce(nullif(btrim(o.name),''),nullif(btrim(o.company),''),''),160) customer_name
  FROM public.orders o
  WHERE public.referral_eligible_past_order(o.email,o.payment_status,o.status,o.payment_method)
  ORDER BY lower(btrim(o.email)),(nullif(btrim(o.name),'') IS NULL),o.created_at DESC NULLS LAST,o.id DESC
 ), page AS (
  SELECT * FROM customers WHERE (after_key IS NULL OR customer_email>after_key)
   AND (query_key='' OR position(query_key IN customer_email)>0 OR position(query_key IN lower(customer_name))>0)
  ORDER BY customer_email LIMIT p_limit+1
 ), shown AS (SELECT * FROM page ORDER BY customer_email LIMIT p_limit)
 SELECT jsonb_build_object('customers',coalesce((SELECT jsonb_agg(jsonb_build_object('email',customer_email,'name',customer_name) ORDER BY customer_email) FROM shown),'[]'::jsonb),
  'nextCursor',CASE WHEN (SELECT count(*) FROM page)>p_limit THEN (SELECT max(customer_email) FROM shown) ELSE NULL END)
 INTO answer;
 RETURN answer;
END; $$;
CREATE OR REPLACE FUNCTION public.referral_create_partner(p_actor uuid,p_email text,p_name text,p_code text DEFAULT NULL,p_generate boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_email text:=lower(btrim(p_email)); v_name text:=btrim(p_name); v_code text:=upper(btrim(coalesce(p_code,''))); new_id uuid; constraint_name text; attempt integer; BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_generate IS NULL THEN RAISE EXCEPTION 'Choose a custom or generated code'; END IF;
 IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 160 OR NOT EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(orders.email))=v_email AND public.referral_eligible_past_order(orders.email,orders.payment_status,orders.status,orders.payment_method)) THEN RAISE EXCEPTION 'Select a named existing paid customer email'; END IF;
 IF v_code='' AND p_generate THEN v_code:=public.referral_random_code(); END IF;
 IF v_code !~ '^[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]$' THEN RAISE EXCEPTION 'Use 3–24 letters, numbers or internal hyphens; no spaces'; END IF;
 FOR attempt IN 1..8 LOOP
  BEGIN
   INSERT INTO public.referral_partners(email,name,code) VALUES(v_email,v_name,v_code) RETURNING id INTO new_id;
   INSERT INTO public.referral_audit(actor_id,action,entity_id,details) VALUES(p_actor,'create',new_id::text,jsonb_build_object('code',v_code,'generated',p_generate));
   RETURN jsonb_build_object('id',new_id,'code',v_code,'generated',p_generate);
  EXCEPTION WHEN unique_violation THEN
   GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
   IF constraint_name='referral_partners_email_key' THEN RAISE EXCEPTION 'This customer already has a referral code'; END IF;
   IF constraint_name<>'referral_partners_code_key' THEN RAISE; END IF;
   IF NOT p_generate THEN RAISE EXCEPTION 'That referral code is already in use. Choose another code'; END IF;
   v_code:=public.referral_random_code();
  END;
 END LOOP;
 RAISE EXCEPTION 'Could not generate a unique code. Try Generate code again';
END; $$;
REVOKE ALL ON FUNCTION public.referral_eligible_past_order(text,text,text,text),public.referral_past_customer_search(uuid,text,text,integer),public.referral_create_partner(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.referral_eligible_past_order(text,text,text,text),public.referral_past_customer_search(uuid,text,text,integer),public.referral_create_partner(uuid,text,text,text,boolean) TO service_role;
COMMIT;
