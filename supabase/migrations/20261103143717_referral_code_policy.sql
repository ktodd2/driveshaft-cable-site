-- LOCAL STAGED: policy storage. The following runtime migration composes checkout
-- coordination, immutable transaction terms, and the confirmed stacking/edit rules.
-- No flags, schedules, browser grants, historical rates or payouts are changed.
BEGIN;
CREATE FUNCTION public.referral_valid_tiers(p_tiers jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE t jsonb; last_order bigint:=0; finish numeric; rate numeric;
BEGIN
 IF jsonb_typeof(p_tiers) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_tiers) NOT BETWEEN 1 AND 20 THEN RETURN false; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(p_tiers) LOOP
  IF jsonb_typeof(t) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(t))<>2
   OR jsonb_typeof(t->'through') IS DISTINCT FROM 'number' OR jsonb_typeof(t->'bps') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  finish:=(t->>'through')::numeric; rate:=(t->>'bps')::numeric;
  IF finish<>trunc(finish) OR finish<=last_order OR finish>2147483647 OR rate<>trunc(rate) OR rate NOT BETWEEN 0 AND 10000 THEN RETURN false; END IF;
  last_order:=finish::bigint;
 END LOOP;
 RETURN true;
END; $$;
ALTER TABLE public.referral_partners
 ADD COLUMN buyer_discount_bps integer NOT NULL DEFAULT 500 CHECK(buyer_discount_bps BETWEEN 0 AND 10000),
 ADD COLUMN commission_tiers jsonb NOT NULL DEFAULT '[{"through":1,"bps":1000},{"through":2,"bps":500},{"through":10,"bps":200},{"through":20,"bps":100}]' CHECK(public.referral_valid_tiers(commission_tiers)),
 ADD COLUMN policy_revision integer NOT NULL DEFAULT 1 CHECK(policy_revision>0);
CREATE TABLE public.referral_policy_versions(
 partner_id uuid NOT NULL REFERENCES public.referral_partners,
 revision integer NOT NULL CHECK(revision>0),
 buyer_discount_bps integer NOT NULL CHECK(buyer_discount_bps BETWEEN 0 AND 10000),
 commission_tiers jsonb NOT NULL CHECK(public.referral_valid_tiers(commission_tiers)),
 actor_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(partner_id,revision)
);
ALTER TABLE public.referral_policy_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_policy_versions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.referral_policy_versions TO service_role;
INSERT INTO public.referral_policy_versions(partner_id,revision,buyer_discount_bps,commission_tiers)
 SELECT id,policy_revision,buyer_discount_bps,commission_tiers FROM public.referral_partners;
CREATE FUNCTION public.referral_initial_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.referral_policy_versions(partner_id,revision,buyer_discount_bps,commission_tiers)
 VALUES(NEW.id,NEW.policy_revision,NEW.buyer_discount_bps,NEW.commission_tiers);
 RETURN NEW;
END; $$;
CREATE TRIGGER referral_initial_policy AFTER INSERT ON public.referral_partners
 FOR EACH ROW EXECUTE FUNCTION public.referral_initial_policy();
CREATE FUNCTION public.referral_set_code_policy(p_actor uuid,p_partner uuid,p_expected_revision integer,p_discount_bps integer,p_tiers jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE partner public.referral_partners; updated public.referral_partners;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_expected_revision IS NULL OR p_discount_bps IS NULL OR p_discount_bps NOT BETWEEN 0 AND 10000 OR NOT public.referral_valid_tiers(p_tiers) THEN RAISE EXCEPTION 'Use a discount from 0 to 100 percent and 1–20 increasing whole-order tiers with rates from 0 to 100 percent'; END IF;
 SELECT * INTO partner FROM public.referral_partners WHERE id=p_partner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Referral code unavailable'; END IF;
 IF partner.policy_revision<>p_expected_revision THEN RAISE EXCEPTION 'Code settings changed. Refresh and review before saving'; END IF;
 IF partner.buyer_discount_bps=p_discount_bps AND partner.commission_tiers=p_tiers THEN RETURN to_jsonb(partner); END IF;
 UPDATE public.referral_partners SET buyer_discount_bps=p_discount_bps,commission_tiers=p_tiers,policy_revision=policy_revision+1
 WHERE id=partner.id RETURNING * INTO updated;
 INSERT INTO public.referral_policy_versions(partner_id,revision,buyer_discount_bps,commission_tiers,actor_id)
 VALUES(updated.id,updated.policy_revision,updated.buyer_discount_bps,updated.commission_tiers,p_actor);
 INSERT INTO public.referral_audit(actor_id,action,entity_id,details) VALUES(p_actor,'code_policy',partner.id::text,
 jsonb_build_object('before_revision',partner.policy_revision,'after_revision',updated.policy_revision,
 'before_discount_bps',partner.buyer_discount_bps,'after_discount_bps',updated.buyer_discount_bps,
 'before_tiers',partner.commission_tiers,'after_tiers',updated.commission_tiers));
 RETURN to_jsonb(updated);
END; $$;
REVOKE ALL ON FUNCTION public.referral_valid_tiers(jsonb),public.referral_initial_policy(),public.referral_set_code_policy(uuid,uuid,integer,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.referral_valid_tiers(jsonb),public.referral_initial_policy(),public.referral_set_code_policy(uuid,uuid,integer,integer,jsonb) TO service_role;
COMMIT;
