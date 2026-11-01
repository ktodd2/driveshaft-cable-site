-- Explicit public projection and capability-based submission API.
-- SECURITY DEFINER is intentional: anonymous callers never receive table access.
-- Public reads expose approved/consented quotes only. Private request operations
-- require the existing cryptographically random 192-bit token, not a row ID.
CREATE OR REPLACE FUNCTION public.get_public_testimonials()
RETURNS TABLE(id uuid, display_name text, testimonial_text text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.id, t.display_name, t.testimonial_text FROM public.testimonials t
  WHERE t.approved IS TRUE AND t.consented_to_promo IS TRUE AND t.status = 'approved'
    AND pg_catalog.btrim(t.display_name) <> '' AND pg_catalog.btrim(t.testimonial_text) <> ''
  ORDER BY t.submitted_at DESC NULLS LAST, t.id LIMIT 6
$$;

CREATE OR REPLACE FUNCTION public.get_testimonial_request(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object('status', t.status, 'expires_at', t.expires_at,
    'display_name', COALESCE(NULLIF(pg_catalog.btrim(t.display_name), ''),
      pg_catalog.split_part(pg_catalog.regexp_replace(pg_catalog.btrim(t.customer_name), '\s+', ' ', 'g'), ' ', 1) ||
      CASE WHEN pg_catalog.btrim(t.customer_name) ~ '\s' THEN ' ' || pg_catalog.upper(pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(t.customer_name), '^.*\s', ''), 1)) || '.' ELSE '' END))
  FROM public.testimonials t WHERE p_token ~ '^[a-f0-9]{48}$' AND t.token = p_token
$$;

CREATE OR REPLACE FUNCTION public.submit_testimonial_request(p_token text, p_text text, p_display_name text, p_consent boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{48}$' OR p_consent IS DISTINCT FROM TRUE
    OR p_text IS NULL OR pg_catalog.length(pg_catalog.btrim(p_text)) NOT BETWEEN 1 AND 5000
    OR p_display_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_display_name)) NOT BETWEEN 1 AND 100 THEN
    RETURN false;
  END IF;
  UPDATE public.testimonials SET testimonial_text = pg_catalog.btrim(p_text),
    display_name = pg_catalog.btrim(p_display_name), consented_to_promo = true,
    submitted_at = pg_catalog.now(), status = 'submitted', approved = false
  WHERE token = p_token AND status = 'pending' AND expires_at > pg_catalog.now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_testimonials() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_testimonial_request(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_testimonial_request(text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_testimonials() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_testimonial_request(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_testimonial_request(text,text,text,boolean) TO anon, authenticated, service_role;
