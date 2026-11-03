-- STAGED composition safeguard: no historical commissions or guessed legacy payment ordering.
BEGIN;
CREATE OR REPLACE FUNCTION public.referral_reconcile(p_email text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.referral_checkouts; b public.referral_buyers; n integer; r integer; v_partner uuid; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_email,7221));
 FOR c IN SELECT * FROM public.referral_checkouts WHERE email=p_email AND state='observed' ORDER BY paid_at,order_id FOR UPDATE LOOP
  IF NOT c.paid_time_verified THEN RETURN; END IF;
  -- A prior unresolved intent might have paid earlier. Hold rewards only, never checkout or payment.
  IF EXISTS(SELECT 1 FROM public.referral_checkouts x WHERE x.email=p_email AND x.order_id<>c.order_id AND
   ((x.state='prepared' AND x.created_at<=least(c.first_observed_at,c.paid_at+interval '1 second') AND (x.observed_unpaid_at IS NULL OR x.observed_unpaid_at<c.paid_at)) OR
    (x.state='observed' AND NOT x.paid_time_verified AND x.created_at<=least(c.first_observed_at,c.paid_at+interval '1 second')))) THEN RETURN; END IF;
  SELECT * INTO b FROM public.referral_buyers WHERE email=p_email FOR UPDATE;
  IF NOT FOUND THEN
   v_partner:=c.partner_id;
   IF c.partner_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.orders o WHERE lower(btrim(o.email))=p_email AND o.payment_status IN('paid','refunded','partially_refunded') AND o.id<>c.order_id AND NOT EXISTS(SELECT 1 FROM public.referral_checkouts x WHERE x.order_id=o.id)) THEN
    -- A newly paid legacy/non-referral checkout has no immutable referral paid-time proof.
    -- Hold rather than permanently disqualifying a potentially earlier code-bearing payment.
    RETURN;
   END IF;
   INSERT INTO public.referral_buyers(email,partner_id,first_order_id) VALUES(p_email,v_partner,c.order_id) RETURNING * INTO b;
  END IF;
  IF b.partner_id IS NOT NULL THEN
   PERFORM 1 FROM public.referral_partners WHERE id=b.partner_id FOR UPDATE;
   n:=b.next_sequence; r:=CASE WHEN n=1 THEN 1000 WHEN n=2 THEN 500 WHEN n<=10 THEN 200 ELSE 100 END;
   INSERT INTO public.referral_earnings(order_id,partner_id,email,sequence,rate_bps,base_cents,original_cents,paid_at,available_at,refunded_total_cents,merchandise_refund_cents,refund_review,disputed,dispute_version)
   VALUES(c.order_id,b.partner_id,p_email,n,r,c.merchandise_cents,round(c.merchandise_cents::numeric*r/10000),c.paid_at,c.paid_at+interval '7 days',c.refunded_total_cents,c.merchandise_refund_cents,c.refund_review,c.disputed,c.dispute_version);
   UPDATE public.referral_buyers SET next_sequence=next_sequence+1 WHERE email=p_email;
  END IF;
  UPDATE public.referral_checkouts SET state='paid' WHERE order_id=c.order_id;
  INSERT INTO public.referral_audit(action,entity_id,details) VALUES('verified_payment',c.order_id::text,jsonb_build_object('intent_id',c.intent_id,'paid_at',c.paid_at));
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.referral_reconcile(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.referral_reconcile(text) TO service_role;
COMMIT;
