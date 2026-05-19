-- Helper RPC for scheduling email-automation cron jobs.
--
-- pg_cron's cron.schedule() is restricted to the postgres role; SECURITY DEFINER
-- + service_role-only EXECUTE grant lets the setup-cron-jobs edge function
-- schedule jobs without exposing cron functions to anon/authenticated roles.
--
-- The trigger_key (a dedicated low-privilege auth token, not the service role
-- key) ends up in cron.job.command, which is in the cron schema — restricted
-- to admins and not exposed via PostgREST. Limited blast radius.
--
-- Idempotent: re-running unschedules any existing job with the same name first.

CREATE OR REPLACE FUNCTION schedule_email_cron(
  job_name TEXT,
  cron_schedule TEXT,
  function_url TEXT,
  trigger_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cmd TEXT;
BEGIN
  -- Drop existing job with this name if present.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
    PERFORM cron.unschedule(job_name);
  END IF;

  -- Build the SQL pg_cron will execute. Headers are inlined as a JSONB
  -- literal. format() with %L safely quotes the inputs.
  cmd := format(
    'SELECT net.http_post(url := %L, headers := %L::jsonb) AS request_id',
    function_url,
    json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || trigger_key
    )::text
  );

  PERFORM cron.schedule(job_name, cron_schedule, cmd);
END $$;

REVOKE EXECUTE ON FUNCTION schedule_email_cron(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION schedule_email_cron(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Convenience view of email-automation cron jobs for the admin panel and
-- debugging. Read-only.
CREATE OR REPLACE FUNCTION list_email_cron_jobs()
RETURNS TABLE (job_name TEXT, schedule TEXT, active BOOLEAN, last_status TEXT, last_finished_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.jobname::TEXT,
    j.schedule::TEXT,
    j.active,
    jrd.status::TEXT,
    jrd.end_time::TIMESTAMPTZ
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT status, end_time
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY end_time DESC NULLS LAST
    LIMIT 1
  ) jrd ON true
  WHERE j.jobname LIKE 'send-%';
$$;

GRANT EXECUTE ON FUNCTION list_email_cron_jobs() TO authenticated;
