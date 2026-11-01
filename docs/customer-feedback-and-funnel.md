# Customer feedback and shopping funnel

November 1, 2026. General customer feedback appears on the homepage below the catalog. The public feed includes only an administrator-approved quote with explicit promotional permission and the customer's chosen credit. It makes no star-rating, verified-purchaser, employer or specific-product endorsement claim. Unapproved requests are omitted; an empty or unavailable feed hides the section.

The public feedback RPC returns three fields only: quote ID, display credit and quote text. Private testimonial links use the existing random 192-bit capability to retrieve a minimal request state and submit once before expiry. Submission requires explicit permission and cannot set approval or change customer/order details. Direct table access is restricted to active site administrators; service queue access is preserved. Existing customer requests and permissions remain unchanged.

Deploy the public API migration before the website. Deploy the private-access migration after the website switches to the scoped RPCs. Run tests/integration/testimonialAccess.sql against the final migrations; its temporary fixtures and state changes all roll back.

## Funnel definitions

- view_item: once per product-page visit after product and inventory resolution. Quantity/value represent the purchasable minimum, using the current tier/sale price. Changing the quantity input does not create another product view.
- add_to_cart: centralized at the successful cart state change, across all add buttons. Reports only the units actually added after normalization, at the resulting cart line's tier/sale price. Bolt quantities count 10-packs, matching the catalog and purchase event.
- begin_checkout: once per checkout mount with a nonempty basket after catalog and sales load. Uses the displayed merchandise subtotal before address-dependent tax, shipping, loyalty eligibility or subsequently entered codes.
- purchase: existing independently verified paid-payment path and durable server queue remain unchanged. Final purchase value is discounted merchandise, with shipping and tax separate. Test payments and unverified success URLs do not generate production purchases. Existing transaction IDs, unique queue keys, leases and browser markers handle duplicates.

Funnel payloads allow only product IDs, integer quantities and prices. USD and value are explicit. No customer contact details, codes, capability URLs, form fields or query strings are copied. Existing opt-out, consent denial and Global Privacy Control suppress tracking. Tag errors never block shopping. Events queued in gtag or accepted over HTTP are not proof of report ingestion.

## Validation and remaining external checks

Unit tests cover payload math, pack quantities, normalized additions, threshold pricing, privacy, opt-outs, duplicate views and tag failure. Public-page build verifies approved feedback projection and initial HTML. Existing purchase tests cover test-mode exclusion and transaction deduplication. Google's Measurement Protocol debug endpoint returned an empty validationMessages array; this validation endpoint does not record events.

The live purchase queue had eight submitted entries when checked. This is transport evidence only. Analytics, Search Console and Merchant Center account connections are still needed to confirm GA ingestion/attribution, key-event settings, search impressions/clicks, sitemap processing, account issues and free-listing eligibility. Do not infer Merchant Center approval from valid structured data.

After account verification, compare consistent date windows for product-view users, add-to-cart users, checkout users, purchasers and purchase revenue. Use users rather than raw event counts for funnel rates, segment by device and traffic source, and distinguish ecommerce revenue from shipping/tax. Use test-mode payments and blocked/intercepted analytics for payment QA; never create a production purchase event as a test.
