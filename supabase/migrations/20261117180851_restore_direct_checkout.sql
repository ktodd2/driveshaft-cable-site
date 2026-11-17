-- Restore direct checkout without CAPTCHA or email-link proof.
-- Keep server pricing, referral validation and first-checkout coordination intact.
BEGIN;
CREATE OR REPLACE FUNCTION public.buyer_checkout_needs_verification(p_email text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT false;
$$;
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
 IF EXISTS(SELECT 1 FROM public.orders o LEFT JOIN public.checkout_requests c ON c.order_id=o.id WHERE lower(btrim(o.email))=email_key AND (coalesce(o.payment_method,'stripe')='stripe' OR nullif(o.stripe_payment_intent_id,'') IS NOT NULL OR c.id IS NOT NULL) AND coalesce(o.payment_status,'') NOT IN('paid','refunded','partially_refunded') AND (c.id IS NULL OR (NOT c.first_order_coordinated AND c.cancelled_at IS NULL))) THEN RAISE EXCEPTION 'An earlier payment needs verification before another first order. Resume it or contact us'; END IF;
 RETURN true;
END; $$;

COMMIT;
