-- Integration validation only: explicit transaction rollback, no network/email.
-- Run after expand, preferably staging first. Never omit the ROLLBACK.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE q jsonb:=jsonb_build_object('name','Guard transaction QA','company','Synthetic rollback test','email','guard-qa@example.invalid','phone','','quantity',10,'message','Synthetic transaction test; rollback required'); a jsonb; b jsonb; i int;
        seed text:=md5(clock_timestamp()::text || random()::text);
BEGIN
  a:=public.submit_quote_guarded(q,seed||'request1',seed||'payload1',seed||'email',seed||'ip','{}');
  IF (a->>'notify')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'normal submission not accepted'; END IF;
  b:=public.submit_quote_guarded(q,seed||'request1',seed||'payload1',seed||'email',seed||'ip','{}');
  IF (b->>'quote_id') IS DISTINCT FROM (a->>'quote_id') OR (b->>'notify')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'pending duplicate recovery failed'; END IF;
  UPDATE public.quote_submission_guard SET notification_state='unknown' WHERE quote_id=(a->>'quote_id')::bigint;
  b:=public.submit_quote_guarded(q,seed||'request1',seed||'payload1',seed||'email',seed||'ip','{}');
  IF (b->>'notify')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'uncertain notification retry permitted'; END IF;
  b:=public.submit_quote_guarded(q,seed||'request1',seed||'different',seed||'email',seed||'ip','{}');
  IF (b->>'conflict')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'request payload conflict missing'; END IF;
  b:=public.submit_quote_guarded(q,seed||'request2',seed||'payload2',seed||'email',seed||'ip',ARRAY['honeypot']);
  IF (b->>'notify')::boolean IS DISTINCT FROM false OR NOT EXISTS(SELECT 1 FROM public.quote_submission_guard WHERE quote_id=(b->>'quote_id')::bigint AND review_state='quarantined' AND notification_state='suppressed') THEN RAISE EXCEPTION 'quarantine failed'; END IF;
  FOR i IN 3..10 LOOP
    b:=public.submit_quote_guarded(q,seed||'request'||i,seed||'payload'||i,seed||'email',seed||'ip','{}');
  END LOOP;
  b:=public.submit_quote_guarded(q,seed||'request11',seed||'payload11',seed||'email',seed||'ip','{}');
  IF (b->>'limited')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'email rate cap failed'; END IF;
END $$;
ROLLBACK;
-- Sequence numbers may advance despite rollback; no customer rows persist.
