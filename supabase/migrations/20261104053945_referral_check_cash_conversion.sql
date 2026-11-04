-- Prospective redemption conversion; old requests/statements keep their original full-value snapshots.
-- No earnings, commission rates, payout states, orders, sends or schedules are changed.
BEGIN;
LOCK TABLE public.referral_partners,public.referral_earnings IN SHARE MODE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.referral_earnings) OR EXISTS(SELECT 1 FROM public.referral_partners WHERE accepted_at IS NOT NULL) THEN RAISE EXCEPTION 'Existing earned rewards or accepted terms require an owner policy decision before this conversion'; END IF; END $$;
ALTER TABLE public.referral_redemptions
 ADD COLUMN cash_value_bps integer NOT NULL DEFAULT 10000 CHECK(cash_value_bps IN(5000,10000)),
 ADD COLUMN conversion_version text NOT NULL DEFAULT 'legacy-full-value-v1',
 ADD COLUMN check_amount_cents integer GENERATED ALWAYS AS(CASE WHEN kind='check' THEN (total_cents::bigint*cash_value_bps/10000)::integer ELSE 0 END) STORED;
ALTER TABLE public.referral_redemptions ALTER COLUMN conversion_version SET DEFAULT 'product-full-value-v1';
ALTER TABLE public.referral_redemptions ADD CONSTRAINT referral_redemption_conversion CHECK(
 (conversion_version='legacy-full-value-v1' AND cash_value_bps=10000) OR
 (kind='product' AND conversion_version='product-full-value-v1' AND cash_value_bps=10000) OR
 (kind='check' AND conversion_version='check-half-value-v1' AND cash_value_bps=5000 AND merchandise_cents>=2 AND merchandise_cents%2=0 AND shipping_cents=0 AND tax_cents=0));
CREATE FUNCTION public.referral_freeze_redemption_terms() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW.id,NEW.partner_id,NEW.kind,NEW.merchandise_cents,NEW.shipping_cents,NEW.tax_cents,NEW.total_cents,NEW.cash_value_bps,NEW.conversion_version) IS DISTINCT FROM ROW(OLD.id,OLD.partner_id,OLD.kind,OLD.merchandise_cents,OLD.shipping_cents,OLD.tax_cents,OLD.total_cents,OLD.cash_value_bps,OLD.conversion_version) THEN RAISE EXCEPTION 'Redemption financial terms are immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER referral_redemption_terms_immutable BEFORE UPDATE ON public.referral_redemptions FOR EACH ROW EXECUTE FUNCTION public.referral_freeze_redemption_terms();
ALTER TABLE public.referral_statements ADD COLUMN cash_value_bps integer NOT NULL DEFAULT 10000 CHECK(cash_value_bps IN(5000,10000));
ALTER TABLE public.referral_statements ALTER COLUMN cash_value_bps SET DEFAULT 5000;
CREATE OR REPLACE FUNCTION public.referral_admin(p_actor uuid,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p public.referral_partners; d public.referral_redemptions; e public.referral_earnings; c public.referral_checkouts; v_id uuid; v_total integer; v_cash integer; v_rate integer; v_version text; v_balance jsonb; v_month text; BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
 RETURN jsonb_build_object('settings',(SELECT to_jsonb(s) FROM public.referral_settings s),
 'partners',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('balance',public.referral_balance(r.id)) ORDER BY r.created_at DESC) FROM public.referral_partners r),'[]'::jsonb),
 'unsettled',coalesce((SELECT jsonb_agg(jsonb_build_object('order_id',x.order_id,'email',x.email,'state',x.state,'paid_at',x.paid_at,'paid_time_verified',x.paid_time_verified) ORDER BY x.created_at) FROM public.referral_checkouts x WHERE state='observed'),'[]'::jsonb),
 'earnings',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY paid_at DESC) FROM public.referral_earnings x),'[]'::jsonb),
 'redemptions',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_at DESC) FROM public.referral_redemptions x),'[]'::jsonb),
 'statements',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_at DESC) FROM public.referral_statements x),'[]'::jsonb));
 ELSIF p_action='create' THEN
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE lower(btrim(email))=lower(btrim(p_data->>'email')) AND payment_status='paid' AND coalesce(status,'') NOT IN('test','synthetic','cancelled')) THEN RAISE EXCEPTION 'Select an existing paid customer email'; END IF;
 INSERT INTO public.referral_partners(email,name,code) VALUES(lower(btrim(p_data->>'email')),btrim(p_data->>'name'),upper(btrim(p_data->>'code'))) RETURNING id INTO v_id;
 ELSIF p_action='invite' THEN
 SELECT * INTO p FROM public.referral_partners WHERE id=(p_data->>'partner_id')::uuid FOR UPDATE;
 IF NOT FOUND OR p.status<>'invited' THEN RAISE EXCEPTION 'Partner is not awaiting signup'; END IF;
 IF EXISTS(SELECT 1 FROM public.referral_invites WHERE partner_id=p.id AND used_at IS NULL AND expires_at>now()) THEN RAISE EXCEPTION 'Existing invitation requires delivery review or expiry'; END IF;
 INSERT INTO public.referral_invites(partner_id,token_hash,expires_at) VALUES(p.id,p_data->>'hash',now()+interval '7 days') RETURNING id INTO v_id;
 ELSIF p_action='status' THEN
 IF p_data->>'status' NOT IN('active','paused') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE public.referral_partners SET status=p_data->>'status' WHERE id=(p_data->>'partner_id')::uuid AND accepted_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Completed signup required'; END IF;
 ELSIF p_action='refund' THEN
 SELECT * INTO e FROM public.referral_earnings WHERE order_id=(p_data->>'order_id')::uuid;
 IF e.order_id IS NULL THEN RAISE EXCEPTION 'Earning missing'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(e.email,7221));
 PERFORM 1 FROM public.referral_partners WHERE id=e.partner_id FOR UPDATE;
 SELECT * INTO e FROM public.referral_earnings WHERE order_id=(p_data->>'order_id')::uuid FOR UPDATE;
 SELECT * INTO c FROM public.referral_checkouts WHERE order_id=e.order_id;
 v_total:=(p_data->>'merchandise_cents')::integer;
 IF e.order_id IS NULL OR NOT e.refund_review OR (p_data->>'refunded_total_cents')::integer IS DISTINCT FROM e.refunded_total_cents OR v_total IS NULL OR v_total<greatest(e.merchandise_refund_cents,e.refunded_total_cents-c.shipping_cents-c.tax_cents) OR v_total>least(e.base_cents,e.refunded_total_cents) THEN RAISE EXCEPTION 'Refund changed or allocation invalid; refresh'; END IF;
 UPDATE public.referral_checkouts SET merchandise_refund_cents=v_total,refund_review=false WHERE order_id=e.order_id;
 UPDATE public.referral_earnings SET merchandise_refund_cents=v_total,refund_review=false WHERE order_id=e.order_id;
 ELSIF p_action='request' THEN
 v_id:=(p_data->>'id')::uuid;
 PERFORM 1 FROM public.referral_partners WHERE id=(p_data->>'partner_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Partner missing'; END IF;
 SELECT * INTO d FROM public.referral_redemptions WHERE id=v_id;
 IF FOUND THEN
  IF d.partner_id IS DISTINCT FROM (p_data->>'partner_id')::uuid OR d.kind IS DISTINCT FROM p_data->>'kind' OR d.merchandise_cents IS DISTINCT FROM (p_data->>'merchandise_cents')::integer OR d.shipping_cents IS DISTINCT FROM (p_data->>'shipping_cents')::integer OR d.tax_cents IS DISTINCT FROM (p_data->>'tax_cents')::integer OR d.notes IS DISTINCT FROM p_data->>'notes' THEN RAISE EXCEPTION 'Request identity reused with different details'; END IF;
  IF d.kind='check' AND ((d.conversion_version='check-half-value-v1' AND (p_data->>'redemption_version' IS DISTINCT FROM d.conversion_version OR (p_data->>'check_cash_cents')::integer IS DISTINCT FROM d.check_amount_cents)) OR (d.conversion_version='legacy-full-value-v1' AND p_data ? 'check_cash_cents')) THEN RAISE EXCEPTION 'Existing request keeps its recorded terms; review the original request'; END IF;
  RETURN jsonb_build_object('id',v_id);
 END IF;
 IF p_data->>'kind'='check' THEN
  IF p_data->>'redemption_version' IS DISTINCT FROM 'check-half-value-v1' THEN RAISE EXCEPTION 'Check reward terms changed. Refresh and review before saving'; END IF;
  IF jsonb_typeof(p_data->'check_cash_cents') IS DISTINCT FROM 'number' OR coalesce(p_data->>'check_cash_cents','') !~ '^[0-9]+$' OR (p_data->>'check_cash_cents')::numeric NOT BETWEEN 1 AND 1073741823 THEN RAISE EXCEPTION 'Enter a valid check amount in whole cents'; END IF;
  v_cash:=(p_data->>'check_cash_cents')::integer;v_total:=v_cash*2;v_rate:=5000;v_version:='check-half-value-v1';
  IF (p_data->>'merchandise_cents')::integer IS DISTINCT FROM v_total OR (p_data->>'shipping_cents')::integer IS DISTINCT FROM 0 OR (p_data->>'tax_cents')::integer IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Check must redeem two reward cents per cash cent, without shipping or tax'; END IF;
 ELSE
  v_total:=(p_data->>'merchandise_cents')::integer+(p_data->>'shipping_cents')::integer+(p_data->>'tax_cents')::integer;v_cash:=0;v_rate:=10000;v_version:='product-full-value-v1';
 END IF;
 INSERT INTO public.referral_redemptions(id,partner_id,kind,merchandise_cents,shipping_cents,tax_cents,total_cents,notes,cash_value_bps,conversion_version)
 VALUES(v_id,(p_data->>'partner_id')::uuid,p_data->>'kind',(p_data->>'merchandise_cents')::integer,(p_data->>'shipping_cents')::integer,(p_data->>'tax_cents')::integer,v_total,p_data->>'notes',v_rate,v_version);
 p_data:=p_data||jsonb_build_object('reward_cost_cents',v_total,'check_amount_cents',v_cash,'cash_value_bps',v_rate,'conversion_version',v_version);
 ELSIF p_action IN('approve','reject','complete') THEN
 SELECT * INTO d FROM public.referral_redemptions WHERE id=(p_data->>'id')::uuid;
 PERFORM 1 FROM public.referral_partners WHERE id=d.partner_id FOR UPDATE;
 SELECT * INTO d FROM public.referral_redemptions WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Request missing'; END IF;
 IF p_action IN('approve','complete') AND d.conversion_version='check-half-value-v1' AND (p_data->>'redemption_version' IS DISTINCT FROM d.conversion_version OR jsonb_typeof(p_data->'check_cash_cents') IS DISTINCT FROM 'number' OR p_data->>'check_cash_cents' IS DISTINCT FROM d.check_amount_cents::text) THEN RAISE EXCEPTION 'Check reward terms changed. Refresh and confirm the recorded cash amount'; END IF;
 v_balance:=public.referral_balance(d.partner_id);
 IF p_action='approve' THEN
 IF d.state IN('reserved','paid') THEN RETURN to_jsonb(d); END IF;
 IF d.state<>'requested' OR (v_balance->>'available')::bigint<d.total_cents THEN RAISE EXCEPTION 'Insufficient available rewards or request changed'; END IF;
 UPDATE public.referral_redemptions SET state='reserved',approved_at=now() WHERE id=d.id;
 ELSIF p_action='complete' THEN
 IF d.state='paid' THEN RETURN to_jsonb(d); END IF;
 IF d.state<>'reserved' OR (v_balance->>'available')::bigint<0 OR length(btrim(coalesce(p_data->>'reference',''))) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Available balance changed or issuance reference missing'; END IF;
 UPDATE public.referral_redemptions SET state='paid',completed_at=now(),reference=p_data->>'reference' WHERE id=d.id;
 ELSE
 IF d.state='paid' THEN RAISE EXCEPTION 'Issued rewards cannot be rejected'; END IF;
 UPDATE public.referral_redemptions SET state='rejected' WHERE id=d.id;
 END IF;
 p_data:=p_data||jsonb_build_object('reward_cost_cents',d.total_cents,'check_amount_cents',d.check_amount_cents,'cash_value_bps',d.cash_value_bps,'conversion_version',d.conversion_version);
 ELSIF p_action='month' THEN
 PERFORM public.referral_monthly();
 ELSE RAISE EXCEPTION 'Unknown referral action'; END IF;
 INSERT INTO public.referral_audit(actor_id,action,entity_id,details) VALUES(p_actor,p_action,coalesce(v_id::text,p_data->>'id',p_data->>'order_id',p_data->>'partner_id'),p_data-'hash'-'email'-'name'-'notes'-'reference');
 RETURN jsonb_build_object('id',v_id);
END; $$;
CREATE OR REPLACE FUNCTION public.referral_invite_preview(p_hash text) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE partner public.referral_partners;
BEGIN
 IF NOT coalesce((SELECT enabled FROM public.referral_settings WHERE id),false) THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 SELECT p.* INTO partner FROM public.referral_invites i JOIN public.referral_partners p ON p.id=i.partner_id WHERE i.token_hash=p_hash AND i.used_at IS NULL AND i.expires_at>now() AND p.status='invited';
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 RETURN jsonb_build_object('code',partner.code,'revision',partner.policy_revision,'buyer_discount_bps',partner.buyer_discount_bps,'tiers',partner.commission_tiers,'redemption_terms_version','check-half-value-v1');
END; $$;
DROP FUNCTION public.referral_signup_policy(text,text,text,text,integer);
CREATE FUNCTION public.referral_signup_policy(p_hash text,p_name text,p_address text,p_preference text,p_revision integer,p_redemption_version text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE invite public.referral_invites; partner public.referral_partners; answer jsonb;
BEGIN
 IF p_redemption_version IS DISTINCT FROM 'check-half-value-v1' THEN RAISE EXCEPTION 'Reward redemption terms changed. Refresh and review before accepting'; END IF;
 SELECT * INTO invite FROM public.referral_invites WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR invite.used_at IS NOT NULL OR invite.expires_at<=now() THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 SELECT * INTO partner FROM public.referral_partners WHERE id=invite.partner_id FOR UPDATE;
 IF p_revision IS NULL OR partner.policy_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Code settings changed. Review the current terms before accepting'; END IF;
 answer:=public.referral_signup(p_hash,p_name,p_address,p_preference);
 INSERT INTO public.referral_audit(action,entity_id,details) VALUES('accept_redemption_terms',partner.id::text,jsonb_build_object('version',p_redemption_version,'check_value_bps',5000,'product_value_bps',10000));
 RETURN answer;
END; $$;
REVOKE ALL ON FUNCTION public.referral_freeze_redemption_terms(),public.referral_signup_policy(text,text,text,text,integer,text),public.referral_admin(uuid,text,jsonb),public.referral_invite_preview(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.referral_freeze_redemption_terms(),public.referral_signup_policy(text,text,text,text,integer,text),public.referral_admin(uuid,text,jsonb),public.referral_invite_preview(text) TO service_role;
COMMIT;
