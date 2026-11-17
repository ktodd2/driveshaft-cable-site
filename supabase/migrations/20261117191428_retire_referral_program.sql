-- Retire new referrals without deleting historical records or touching payments.
BEGIN;
UPDATE public.referral_settings SET enabled=false,emails_enabled=false,auto_statements_enabled=false,buyer_verification_emails_enabled=false WHERE id;
CREATE OR REPLACE FUNCTION public.referral_validate_checkout(p_id uuid,p_order jsonb,p_params jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 -- New ordinary checkouts keep the secure service's total and binding checks.
 -- Old referral-era callers must refresh; already-created immutable snapshots
 -- still use their existing payment/reconciliation paths.
 IF coalesce(p_params#>>'{metadata,referral_system}','')<>'' OR
    coalesce(p_params#>>'{metadata,referral_code}','')<>'' OR
    coalesce(p_order->'referral_policy','null'::jsonb)<>'null'::jsonb THEN
  RAISE EXCEPTION 'Checkout has been updated. Refresh before continuing';
 END IF;
 RETURN false;
END; $$;
-- Preserve the schedule definition for audit, but stop future referral runs.
DO $$ DECLARE j record; BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='cron') THEN
  FOR j IN EXECUTE 'SELECT jobid FROM cron.job WHERE jobname=''referral-monthly-hourly''' LOOP
   PERFORM cron.alter_job(j.jobid,active:=false);
  END LOOP;
 END IF;
END; $$;
COMMIT;
