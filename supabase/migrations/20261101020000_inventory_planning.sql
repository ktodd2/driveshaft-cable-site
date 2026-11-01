-- PREPARED ONLY. Approval required before production application.
-- One shared, revisioned planning document; never writes stock, receipts or costs.
BEGIN;
CREATE TABLE public.inventory_planning_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE TABLE public.inventory_planning_requests (
  request_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  expected_revision integer NOT NULL,
  document jsonb NOT NULL,
  saved_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_planning_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_planning_requests ENABLE ROW LEVEL SECURITY;
-- RPC-only access: no table policies or grants for public, anon or authenticated.
REVOKE ALL ON public.inventory_planning_state, public.inventory_planning_requests FROM PUBLIC, anon, authenticated;
INSERT INTO public.inventory_planning_state(id, document)
VALUES(true, '{"days":30,"lead":"","safety":"","lines":[]}'::jsonb);

CREATE FUNCTION public.get_inventory_plan() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_state public.inventory_planning_state%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND is_active IS TRUE) THEN
    RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_state FROM public.inventory_planning_state WHERE id;
  RETURN jsonb_build_object('revision',v_state.revision,'document',v_state.document,'updated_at',v_state.updated_at);
END;
$$;

CREATE FUNCTION public.save_inventory_plan(p_request_id uuid, p_expected_revision integer, p_document jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_state public.inventory_planning_state%ROWTYPE;
  v_request public.inventory_planning_requests%ROWTYPE;
  v_line jsonb;
  v_receipt text;
  v_quantity integer;
  v_product text;
  v_received bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id=auth.uid() AND is_active IS TRUE) THEN
    RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_document IS NULL THEN RAISE EXCEPTION 'Invalid save request'; END IF;
  SELECT * INTO STRICT v_state FROM public.inventory_planning_state WHERE id FOR UPDATE;
  SELECT * INTO v_request FROM public.inventory_planning_requests WHERE request_id=p_request_id;
  IF FOUND THEN
    IF v_request.actor_id <> auth.uid() OR v_request.expected_revision <> p_expected_revision OR v_request.document <> p_document THEN
      RAISE EXCEPTION 'Request ID reused with different content';
    END IF;
    RETURN jsonb_build_object('status','already_saved','revision',v_request.saved_revision,'current_revision',v_state.revision);
  END IF;
  IF v_state.revision <> p_expected_revision THEN RAISE EXCEPTION 'Plan changed on another device. Fetch and review the latest shared plan.' USING ERRCODE='40001'; END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR octet_length(p_document::text)>200000 THEN RAISE EXCEPTION 'Invalid plan document'; END IF;
  IF coalesce(p_document->>'days','') NOT IN ('7','30','90') OR jsonb_typeof(p_document->'days') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid sales window'; END IF;
  IF jsonb_typeof(p_document->'lead') IS DISTINCT FROM 'string' OR jsonb_typeof(p_document->'safety') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid planning assumptions'; END IF;
  IF p_document->>'lead' !~ '^([0-9]{1,3})?$' OR p_document->>'safety' !~ '^([0-9]{1,3})?$' THEN RAISE EXCEPTION 'Invalid planning assumptions'; END IF;
  IF nullif(p_document->>'lead','')::integer>730 OR nullif(p_document->>'safety','')::integer>730 THEN RAISE EXCEPTION 'Planning assumptions exceed 730 days'; END IF;
  IF jsonb_typeof(p_document->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid plan lines'; END IF;
  IF jsonb_array_length(p_document->'lines')>100 THEN RAISE EXCEPTION 'At most 100 plan lines'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'lines') l GROUP BY l->>'id' HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'lines') l GROUP BY lower(btrim(l->>'reference')),l->>'productId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate plan line or reference/product'; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_document->'lines') LOOP
    IF jsonb_typeof(v_line) IS DISTINCT FROM 'object' OR coalesce(v_line->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid stable line ID'; END IF;
    IF jsonb_typeof(v_line->'reference') IS DISTINCT FROM 'string' OR length(btrim(v_line->>'reference')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid shipment reference'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=v_line->>'productId') THEN RAISE EXCEPTION 'Unknown product'; END IF;
    IF jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number' OR coalesce(v_line->>'quantity','') !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF jsonb_typeof(v_line->'etaStart') IS DISTINCT FROM 'string' OR jsonb_typeof(v_line->'etaEnd') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid estimated dates'; END IF;
    IF v_line->>'etaStart' <> '' OR v_line->>'etaEnd' <> '' THEN
      IF v_line->>'etaStart' !~ '^\d{4}-\d{2}-\d{2}$' OR v_line->>'etaEnd' !~ '^\d{4}-\d{2}-\d{2}$' OR (v_line->>'etaStart')::date > (v_line->>'etaEnd')::date THEN RAISE EXCEPTION 'Invalid estimated date range'; END IF;
    END IF;
    IF jsonb_typeof(v_line->'receiptIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid receipt links'; END IF;
    IF jsonb_array_length(v_line->'receiptIds')>100 THEN RAISE EXCEPTION 'Too many receipt links'; END IF;
    v_received := 0;
    FOR v_receipt IN SELECT jsonb_array_elements_text(v_line->'receiptIds') LOOP
      SELECT quantity,product_id INTO v_quantity,v_product FROM public.product_shipments WHERE id::text=v_receipt FOR SHARE;
      IF NOT FOUND OR v_product IS DISTINCT FROM v_line->>'productId' OR v_quantity IS NULL OR v_quantity<=0 THEN RAISE EXCEPTION 'Missing or mismatched receipt'; END IF;
      v_received := v_received + v_quantity;
    END LOOP;
    IF v_received > (v_line->>'quantity')::integer THEN RAISE EXCEPTION 'Receipts exceed planned quantity'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'lines') l CROSS JOIN LATERAL jsonb_array_elements_text(l->'receiptIds') r GROUP BY r.value HAVING count(*)>1) THEN RAISE EXCEPTION 'Receipt linked more than once'; END IF;
  UPDATE public.inventory_planning_state SET document=p_document,revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE id RETURNING * INTO v_state;
  INSERT INTO public.inventory_planning_requests(request_id,actor_id,expected_revision,document,saved_revision) VALUES(p_request_id,auth.uid(),p_expected_revision,p_document,v_state.revision);
  RETURN jsonb_build_object('status','saved','revision',v_state.revision,'current_revision',v_state.revision);
END;
$$;
REVOKE ALL ON FUNCTION public.get_inventory_plan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_inventory_plan(uuid,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_plan(), public.save_inventory_plan(uuid,integer,jsonb) TO authenticated;
COMMIT;
