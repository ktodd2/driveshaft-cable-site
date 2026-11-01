-- PREPARED ONLY: apply after review/approval, before publishing the new importer.
-- Order-level atomic receipts + globally unique source labels. No email/status updates.
BEGIN;
CREATE TABLE public.shipping_import_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  filename text NOT NULL,
  source_keys text[] NOT NULL,
  labels jsonb NOT NULL,
  before_cost integer,
  after_cost integer NOT NULL CHECK (after_cost >= 0),
  before_tracking text,
  after_tracking text
);
CREATE TABLE public.shipping_import_sources (
  source_key text PRIMARY KEY CHECK (source_key ~ '^[0-9a-f]{64}$'),
  receipt_id bigint NOT NULL REFERENCES public.shipping_import_receipts(id)
);
ALTER TABLE public.shipping_import_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_import_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_receipts_admin_read ON public.shipping_import_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND is_active IS TRUE));
CREATE POLICY shipping_sources_admin_read ON public.shipping_import_sources FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND is_active IS TRUE));
REVOKE ALL ON public.shipping_import_receipts, public.shipping_import_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shipping_import_receipts, public.shipping_import_sources TO authenticated;

CREATE FUNCTION public.apply_shipping_import(
  p_order_id text, p_expected_cost integer, p_expected_tracking text,
  p_tracking text, p_labels jsonb, p_filename text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_keys text[];
  v_total bigint;
  v_existing bigint;
  v_receipt public.shipping_import_receipts%ROWTYPE;
  v_id bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND is_active IS TRUE) THEN
    RAISE EXCEPTION 'Active admin access required';
  END IF;
  IF p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' THEN RAISE EXCEPTION 'Labels must be an array'; END IF;
  IF jsonb_array_length(p_labels) < 1 OR jsonb_array_length(p_labels) > 1000 THEN RAISE EXCEPTION 'Select 1 to 1000 labels per order'; END IF;
  IF p_filename IS NULL OR length(p_filename) > 255 OR length(coalesce(p_tracking, '')) > 250 THEN RAISE EXCEPTION 'Invalid filename or tracking'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_labels) x WHERE
    coalesce(x->>'source_key', '') !~ '^[0-9a-f]{64}$' OR
    coalesce(x->>'cost_cents', '') !~ '^\d{1,10}$' OR
    jsonb_typeof(x->'cost_cents') IS DISTINCT FROM 'number') THEN RAISE EXCEPTION 'Invalid source identity or cost'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_labels) x WHERE x->>'tracking' IS NOT NULL AND x->>'tracking' !~ '^[A-Z0-9][A-Z0-9 -]{0,99}$') THEN
    RAISE EXCEPTION 'Invalid source tracking number';
  END IF;
  IF p_tracking IS DISTINCT FROM p_expected_tracking AND (p_tracking IS NULL OR p_tracking !~ '^[A-Z0-9][A-Z0-9 -]{0,99}$' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_labels) x WHERE x->>'tracking' = p_tracking)) THEN
    RAISE EXCEPTION 'Replacement tracking must be a valid selected source tracking number';
  END IF;
  SELECT array_agg(x->>'source_key' ORDER BY x->>'source_key'), sum((x->>'cost_cents')::bigint)
    INTO v_keys, v_total FROM jsonb_array_elements(p_labels) x;
  IF cardinality(v_keys) <> (SELECT count(DISTINCT k) FROM unnest(v_keys) k) THEN RAISE EXCEPTION 'Duplicate label in request'; END IF;
  IF v_total > 2147483647 THEN RAISE EXCEPTION 'Shipping total is too large'; END IF;
  -- Serialize imports across orders to avoid races when two admins select the same label.
  PERFORM pg_advisory_xact_lock(761104210);
  SELECT * INTO v_order FROM public.orders WHERE id::text = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT count(*) INTO v_existing FROM public.shipping_import_sources WHERE source_key = ANY(v_keys);
  IF v_existing > 0 THEN
    SELECT r.* INTO v_receipt FROM public.shipping_import_receipts r
      WHERE r.source_keys = v_keys AND r.order_id = p_order_id AND r.after_cost = v_total
        AND r.after_tracking IS NOT DISTINCT FROM p_tracking;
    IF FOUND AND v_existing = cardinality(v_keys)
      AND v_order.actual_shipping_cost_cents IS NOT DISTINCT FROM v_receipt.after_cost
      AND v_order.tracking_number IS NOT DISTINCT FROM v_receipt.after_tracking THEN
      RETURN jsonb_build_object('status', 'already_applied', 'receipt_id', v_receipt.id);
    END IF;
    RAISE EXCEPTION 'One or more labels were already imported. Review the saved receipt; do not apply them again.';
  END IF;
  IF v_order.actual_shipping_cost_cents IS DISTINCT FROM p_expected_cost
    OR v_order.tracking_number IS DISTINCT FROM p_expected_tracking THEN
    RAISE EXCEPTION 'Order cost or tracking changed since preview. Refresh and review again.';
  END IF;
  INSERT INTO public.shipping_import_receipts(order_id, actor_id, filename, source_keys, labels, before_cost, after_cost, before_tracking, after_tracking)
    VALUES(p_order_id, auth.uid(), p_filename, v_keys, p_labels, v_order.actual_shipping_cost_cents, v_total::integer, v_order.tracking_number, p_tracking)
    RETURNING id INTO v_id;
  INSERT INTO public.shipping_import_sources(source_key, receipt_id) SELECT k, v_id FROM unnest(v_keys) k;
  UPDATE public.orders SET actual_shipping_cost_cents = v_total::integer, tracking_number = p_tracking, updated_at = now() WHERE id::text = p_order_id;
  RETURN jsonb_build_object('status', 'saved', 'receipt_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_shipping_import(text, integer, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_shipping_import(text, integer, text, text, jsonb, text) TO authenticated;
COMMIT;
