-- STAGED ONLY. Public referral codes are not credentials. Signup bearer tokens remain separate.
BEGIN;
ALTER TABLE public.referral_partners DROP CONSTRAINT referral_partners_code_check;
ALTER TABLE public.referral_partners ADD CONSTRAINT referral_partners_code_check CHECK(code ~ '^[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]$');
CREATE FUNCTION public.referral_random_code() RETURNS text LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public AS $$
DECLARE alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; bytes bytea:=decode(replace(gen_random_uuid()::text,'-',''),'hex'); code text:='DC-'; i integer; BEGIN
 -- Avoid UUID version/variant bytes. Each selected byte supplies five uniform bits from a random UUID.
 FOREACH i IN ARRAY ARRAY[0,1,2,3,4,5,10,11] LOOP code:=code||substr(alphabet,(get_byte(bytes,i)%32)+1,1); END LOOP;
 RETURN code;
END; $$;
CREATE FUNCTION public.referral_create_partner(p_actor uuid,p_email text,p_name text,p_code text DEFAULT NULL,p_generate boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_email text:=lower(btrim(p_email)); v_name text:=btrim(p_name); v_code text:=upper(btrim(coalesce(p_code,''))); new_id uuid; constraint_name text; attempt integer; BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_generate IS NULL THEN RAISE EXCEPTION 'Choose a custom or generated code'; END IF;
 IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 160 OR NOT EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(orders.email))=v_email AND payment_status='paid' AND coalesce(status,'') NOT IN('test','synthetic','cancelled')) THEN RAISE EXCEPTION 'Select a named existing paid customer email'; END IF;
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
REVOKE ALL ON FUNCTION public.referral_random_code(),public.referral_create_partner(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.referral_random_code(),public.referral_create_partner(uuid,text,text,text,boolean) TO service_role;
COMMIT;
