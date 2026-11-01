-- Content-only correction for audit item 10. Run once against the existing
-- catalog before the site build so pre-rendered pages include the same copy.
-- Guards stop the transaction if the target copy has already changed.
-- Prices, dimensions, strength ratings, inventory and order rules are untouched.
DO $claims$
DECLARE changed integer;
BEGIN
  UPDATE public.products
  SET description = E'The Driveshaft Cable is designed to suspend a disconnected driveshaft during professional towing and recovery operations.\n\nIt uses 5/32-inch galvanized steel cable and aluminum couplers. Select the cable length by measuring your setup, and follow the tie-up instructions to check routing, retention and clearance from moving parts before towing.\n\nThis cable is single-use. Cut it off and discard it after each job. Do not reuse a cable or use one that is damaged.',
      features = '[{"title":"Designed for Driveshaft Tie-Up","description":"For suspending a disconnected driveshaft during towing and recovery. Correct installation and clearance must be checked for each setup."},{"title":"Clearance from Moving Parts","description":"Route the cable to hold the disconnected shaft clear of the spinning yoke and rotating hardware. Check clearance before towing."},{"title":"Dedicated Tie-Up Cable","description":"A single-use cable for your driveshaft tie-up kit. Follow the installation instructions for your setup."},{"title":"Compact for Your Kit","description":"Keep cables with your towing and recovery supplies. Inspect each cable before use."},{"title":"Single-Use by Design","description":"Cut off and discard after each job. Do not reuse."}]'::jsonb,
      updated_at = now()
  WHERE id = '1' AND slug = 'driveshaft-cable'
    AND features @> '[{"description":"Eliminates seal damage and secondary transmission failures."}]'::jsonb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Standard cable copy changed; review before applying'; END IF;

  UPDATE public.products
  SET description = E'Sold in packs of 10. The Value Brake Caging Bolt is a manual spring brake caging tool with an 18mm hex. It is intended for use with compatible spring brake chambers.\n\nUse an 18mm socket for this product. Hex size alone does not establish chamber compatibility: confirm the chamber manufacturer specifies a compatible caging bolt and follow its service procedure before use.\n\nMade from heat-treated steel. This listing does not establish a universal fit or a tested load rating for the bolt.',
      features = '[{"title":"18mm Hex","description":"Use an 18mm socket for this product. Check your tools before the job."},{"title":"Manual Spring Brake Caging","description":"For manually caging compatible spring brake chambers. Confirm the chamber manufacturer\u0027s specified tool and service procedure before use."},{"title":"Heat-Treated Steel","description":"Heat-treated steel construction. No tested load rating is specified in this listing."},{"title":"Confirm Chamber Compatibility","description":"Check the required bolt dimensions and chamber specifications before use. Vehicle type or hex size alone does not establish fit."}]'::jsonb,
      tagline = '18mm hex · 10 bolts per pack · confirm chamber compatibility',
      showcase_bullets = '["18mm hex","10 bolts per pack","For compatible spring brake chambers"]'::jsonb,
      short_description = 'Pack of 10 manual spring brake caging bolts with an 18mm hex. Confirm chamber compatibility and use an 18mm socket.',
      specs = (specs - 'Standard Variant') || jsonb_build_object('Socket', '18mm', 'Use Case', 'Manual caging of compatible spring brake chambers'),
      updated_at = now()
  WHERE id = '3' AND slug = 'value-brake-caging-bolt'
    AND features @> '[{"description":"Built to handle the load of a fully-charged brake spring. Cheap bolts shear under load — these don\u0027t."}]'::jsonb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Brake bolt copy changed; review before applying'; END IF;
END;
$claims$;
