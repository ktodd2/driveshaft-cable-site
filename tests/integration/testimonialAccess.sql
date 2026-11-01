-- Run against the deployed migrations in a single transaction. All fixtures roll back.
BEGIN;
CREATE TEMP TABLE testimonial_fixture AS SELECT pg_catalog.gen_random_uuid() AS id,
  pg_catalog.md5(pg_catalog.random()::text) || pg_catalog.left(pg_catalog.md5(pg_catalog.random()::text),16) AS token;
GRANT SELECT ON testimonial_fixture TO anon, authenticated;
INSERT INTO public.testimonials(id,order_id,customer_name,customer_email,token,expires_at,status)
SELECT f.id,(SELECT id FROM public.orders LIMIT 1),'Fixture Customer','fixture@example.invalid',f.token,
  now()+interval '1 day','pending' FROM testimonial_fixture f;
SET LOCAL ROLE anon;
DO $$ DECLARE token_value text; request jsonb; BEGIN
  SELECT token INTO token_value FROM testimonial_fixture;
  request := public.get_testimonial_request(token_value);
  IF request->>'display_name' <> 'Fixture C.' OR request ? 'customer_email' OR request ? 'customer_name' OR request ? 'token' OR request ? 'order_id' THEN RAISE EXCEPTION 'Private request projection failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.get_public_testimonials() WHERE id=(SELECT id FROM testimonial_fixture)) THEN RAISE EXCEPTION 'Pending request leaked'; END IF;
  IF public.submit_testimonial_request(token_value,'Fixture quote','Fixture C.',false) THEN RAISE EXCEPTION 'Missing consent accepted'; END IF;
  IF public.submit_testimonial_request(token_value,'Fixture quote',repeat('x',101),true) THEN RAISE EXCEPTION 'Invalid credit accepted'; END IF;
  IF NOT public.submit_testimonial_request(token_value,'Fixture quote','Fixture C.',true) THEN RAISE EXCEPTION 'Valid submission failed'; END IF;
  IF public.submit_testimonial_request(token_value,'Replay','Fixture C.',true) THEN RAISE EXCEPTION 'Replay accepted'; END IF;
  BEGIN
    PERFORM id FROM public.testimonials LIMIT 1;
    RAISE EXCEPTION 'Anonymous table read remains possible';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.testimonials SET approved=true WHERE id=(SELECT id FROM testimonial_fixture);
    RAISE EXCEPTION 'Anonymous direct update remains possible';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.testimonials WHERE id=(SELECT id FROM testimonial_fixture) AND approved) THEN RAISE EXCEPTION 'Customer approved own quote'; END IF;
END $$;
UPDATE public.testimonials SET status='approved',approved=true,consented_to_promo=false WHERE id=(SELECT id FROM testimonial_fixture);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.get_public_testimonials() WHERE id=(SELECT id FROM testimonial_fixture)) THEN RAISE EXCEPTION 'Unconsented quote leaked'; END IF;
END $$;
RESET ROLE;
UPDATE public.testimonials SET consented_to_promo=true WHERE id=(SELECT id FROM testimonial_fixture);
SET LOCAL ROLE anon;
DO $$ DECLARE quote jsonb; BEGIN
 SELECT to_jsonb(t) INTO quote FROM public.get_public_testimonials() t WHERE id=(SELECT id FROM testimonial_fixture);
 IF quote IS NULL OR (SELECT count(*) FROM jsonb_object_keys(quote)) <> 3 THEN RAISE EXCEPTION 'Approved quote projection failed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.testimonials) THEN RAISE EXCEPTION 'Non-admin can read requests'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id FROM public.admin_users WHERE is_active IS TRUE LIMIT 1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.testimonials WHERE id=(SELECT id FROM testimonial_fixture)) THEN RAISE EXCEPTION 'Active admin access failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
