-- STAGED ONLY. User-authorized names/spend/commissions go only to the attributed referrer's frozen statement.
BEGIN;
ALTER TABLE public.referral_checkouts ADD COLUMN buyer_name text CHECK(buyer_name IS NULL OR length(buyer_name)<=160), ADD COLUMN buyer_name_captured boolean NOT NULL DEFAULT false;
ALTER TABLE public.referral_statements ADD COLUMN customer_details jsonb;
CREATE INDEX referral_earnings_partner_statement ON public.referral_earnings(partner_id,paid_at,email);
-- No retroactive name lookup/backfill into old statements. New checkouts capture the buyer-provided name before payment.
CREATE FUNCTION public.referral_prepare_named(p_order uuid,p_email text,p_code text,p_merch integer,p_shipping integer,p_tax integer,p_params jsonb,p_buyer_name text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.referral_checkouts; name text:=nullif(left(regexp_replace(btrim(coalesce(p_buyer_name,'')), '[[:cntrl:][:space:]]+', ' ', 'g'),160),''); BEGIN
 PERFORM public.referral_prepare(p_order,p_email,p_code,p_merch,p_shipping,p_tax,p_params);
 SELECT * INTO c FROM public.referral_checkouts WHERE order_id=p_order FOR UPDATE;
 IF c.buyer_name_captured AND c.buyer_name IS DISTINCT FROM name THEN RAISE EXCEPTION 'Checkout name changed; start again'; END IF;
 UPDATE public.referral_checkouts SET buyer_name=name,buyer_name_captured=true WHERE order_id=p_order AND state='prepared' RETURNING * INTO c;
 RETURN to_jsonb(c);
END; $$;
CREATE FUNCTION public.referral_customer_statement(p_partner uuid,p_period text,p_at timestamptz DEFAULT now()) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 WITH dates AS (SELECT to_date(p_period||'-01','YYYY-MM-DD')::timestamp AT TIME ZONE 'America/Chicago' period_end,
 (to_date(p_period||'-01','YYYY-MM-DD')-interval '1 month')::timestamp AT TIME ZONE 'America/Chicago' period_start),
 base AS (
 SELECT e.email customer_key,c.buyer_name,e.sequence,e.paid_at,e.rate_bps,e.base_cents,e.original_cents,e.merchandise_refund_cents,e.refund_review,e.disputed,
 (e.base_cents-e.merchandise_refund_cents)::bigint net_spend,
 round((e.base_cents-e.merchandise_refund_cents)::numeric*e.rate_bps/10000)::bigint commission,
 e.original_cents-round((e.base_cents-e.merchandise_refund_cents)::numeric*e.rate_bps/10000)::bigint reduction,
 e.paid_at>=d.period_start AND e.paid_at<d.period_end in_period,
 CASE WHEN e.refund_review OR e.disputed THEN 'held' WHEN e.available_at>p_at THEN 'pending' ELSE 'vested' END timing
 FROM public.referral_earnings e JOIN public.referral_checkouts c ON c.order_id=e.order_id AND c.email=e.email CROSS JOIN dates d
 WHERE e.partner_id=p_partner AND e.paid_at<=p_at
 ), customers AS (
 SELECT b.customer_key,min(b.paid_at) first_paid,
 jsonb_build_object('name',coalesce((array_agg(nullif(btrim(b.buyer_name),'') ORDER BY b.paid_at,b.sequence) FILTER(WHERE nullif(btrim(b.buyer_name),'') IS NOT NULL))[1],'Customer name unavailable'),
 'period',jsonb_build_object('orders',count(*) FILTER(WHERE in_period),'product_sales_cents',coalesce(sum(base_cents) FILTER(WHERE in_period),0),
 'refunded_product_cents',coalesce(sum(merchandise_refund_cents) FILTER(WHERE in_period),0),'net_product_sales_cents',coalesce(sum(net_spend) FILTER(WHERE in_period AND NOT refund_review),0),
 'refund_allocation_pending_orders',count(*) FILTER(WHERE in_period AND refund_review),'provisional_net_product_sales_cents',coalesce(sum(net_spend) FILTER(WHERE in_period AND refund_review),0),'provisional_commission_cents',coalesce(sum(commission) FILTER(WHERE in_period AND refund_review),0),
 'original_commission_cents',coalesce(sum(original_cents) FILTER(WHERE in_period),0),'refund_reduction_cents',coalesce(sum(reduction) FILTER(WHERE in_period),0),'commission_cents',coalesce(sum(commission) FILTER(WHERE in_period AND NOT refund_review),0)),
 'lifetime',jsonb_build_object('orders',count(*),'product_sales_cents',sum(base_cents),'refunded_product_cents',sum(merchandise_refund_cents),'net_product_sales_cents',coalesce(sum(net_spend) FILTER(WHERE NOT refund_review),0),
 'refund_allocation_pending_orders',count(*) FILTER(WHERE refund_review),'provisional_net_product_sales_cents',coalesce(sum(net_spend) FILTER(WHERE refund_review),0),'provisional_commission_cents',coalesce(sum(commission) FILTER(WHERE refund_review),0),
 'original_commission_cents',sum(original_cents),'refund_reduction_cents',sum(reduction),'commission_cents',coalesce(sum(commission) FILTER(WHERE NOT refund_review),0)),
 'timing',jsonb_build_object('pending_cents',coalesce(sum(commission) FILTER(WHERE timing='pending'),0),'vested_cents',coalesce(sum(commission) FILTER(WHERE timing='vested'),0),'held_cents',coalesce(sum(commission) FILTER(WHERE timing='held'),0)),
 'rates',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY rate_bps DESC) FROM (SELECT x.rate_bps,count(*) orders,coalesce(sum(x.net_spend) FILTER(WHERE NOT x.refund_review),0) net_product_sales_cents,coalesce(sum(x.commission) FILTER(WHERE NOT x.refund_review),0) commission_cents,count(*) FILTER(WHERE x.refund_review) refund_allocation_pending_orders,coalesce(sum(x.net_spend) FILTER(WHERE x.refund_review),0) provisional_net_product_sales_cents,coalesce(sum(x.commission) FILTER(WHERE x.refund_review),0) provisional_commission_cents FROM base x WHERE x.customer_key=b.customer_key GROUP BY x.rate_bps)r),'[]'::jsonb),
 'orders',coalesce((SELECT jsonb_agg(jsonb_build_object('number',x.sequence,'paid_on',to_char(x.paid_at AT TIME ZONE 'America/Chicago','YYYY-MM-DD'),'in_period',x.in_period,
 'rate_bps',x.rate_bps,'refund_allocation_pending',x.refund_review,'dispute_hold',x.disputed,'product_sales_cents',x.base_cents,'refunded_product_cents',x.merchandise_refund_cents,'net_product_sales_cents',x.net_spend,'original_commission_cents',x.original_cents,'refund_reduction_cents',x.reduction,'commission_cents',x.commission,'timing',x.timing) ORDER BY x.paid_at,x.sequence)
 FROM base x WHERE x.customer_key=b.customer_key AND (x.in_period OR x.merchandise_refund_cents>0 OR x.timing<>'vested')),'[]'::jsonb)) detail
 FROM base b GROUP BY b.customer_key
 )
 SELECT jsonb_build_object('version',1,'period_month',to_char(d.period_start AT TIME ZONE 'America/Chicago','YYYY-MM'),'as_of',p_at,
 'customers',coalesce((SELECT jsonb_agg(detail ORDER BY first_paid,customer_key) FROM customers),'[]'::jsonb)) FROM dates d;
$$;
CREATE OR REPLACE FUNCTION public.referral_prepare_statements(p_at timestamptz DEFAULT now(),p_limit integer DEFAULT 200,p_automatic boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE boundary timestamptz:=date_trunc('month',p_at AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago';
 period text:=to_char(p_at AT TIME ZONE 'America/Chicago','YYYY-MM'); s public.referral_settings; added integer; remaining integer; BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid statement batch size'; END IF;
 SELECT * INTO s FROM public.referral_settings WHERE id;
 IF p_automatic AND (NOT s.auto_statements_enabled OR NOT s.emails_enabled OR s.statements_started_at IS NULL OR boundary<public.referral_statement_first_due(s.statements_started_at)) THEN
  RETURN jsonb_build_object('created',0,'remaining',0,'month',period,'not_due',true);
 END IF;
 -- Missing rows, not an offset, are the durable preparation cursor. Concurrent calls share a month lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('referral-statements/'||period,7222));
 INSERT INTO public.referral_statements(partner_id,month,balance,created_at,recipient_email,recipient_name,referral_code,customer_details)
 SELECT p.id,period,public.referral_balance(p.id,p_at),p_at,p.email,p.name,p.code,public.referral_customer_statement(p.id,period,p_at) FROM public.referral_partners p
 WHERE p.accepted_at IS NOT NULL AND p.accepted_at<=boundary AND NOT EXISTS(SELECT 1 FROM public.referral_statements x WHERE x.partner_id=p.id AND x.month=period)
 ORDER BY p.id LIMIT p_limit ON CONFLICT(partner_id,month) DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;
 SELECT count(*) INTO remaining FROM public.referral_partners p WHERE p.accepted_at IS NOT NULL AND p.accepted_at<=boundary AND NOT EXISTS(SELECT 1 FROM public.referral_statements x WHERE x.partner_id=p.id AND x.month=period);
 RETURN jsonb_build_object('created',added,'remaining',remaining,'month',period,'late',extract(day FROM p_at AT TIME ZONE 'America/Chicago')<>1);
END; $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'referral_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
 END LOOP; END $$;
COMMIT;
