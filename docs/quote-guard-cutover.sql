-- Run ONLY after new frontend and submit-quote backend are verified live.
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.quote_requests;
DROP POLICY IF EXISTS "Allow public inserts" ON public.quote_requests;
REVOKE INSERT ON public.quote_requests FROM PUBLIC, anon, authenticated;
-- Administrative writes, if later needed, must use a specifically authorized server endpoint.
