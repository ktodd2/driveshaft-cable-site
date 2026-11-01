# Product and merchant policy markup

Product pages publish one `Offer` per product, using the total price of the minimum purchasable order. For example, ten Standard cables at $3 each produce an offer price of $30. A bolt order quantity of one is one ten-bolt pack, so its offer price is the pack price. The minimum-order total is visible beside purchasing controls, including after a shopper selects another quantity.

The fetched catalog row and the existing cart pricing functions determine the minimum-order price. Active public sales are included in the prerender snapshot and seeded before rendering/hydration without a cart persistence write. Inventory controls availability: zero is OutOfStock; unknown inventory omits availability; a final partial order uses its reduced minimum. Live hooks still refresh the public data. Static initial HTML is refreshed on deployment; scheduled sale boundaries can still require a fresh deployment for initial HTML.

Quantity tiers remain visible on the page. They are not multiple sellers and are not emitted as AggregateOffer or competing active prices. SKU is retained; no manufacturer MPN, GTIN, review, or rating is fabricated. Product additional properties describe the standard ordering increment and bolt pack contents.

The Shipping & Returns page defines the merchant's ShippingService and MerchantReturnPolicy. Product offers reference these policies using the IDs and shapes documented by Google. Shipping conditions are $20 through $599.99 and $0 from exactly $600, with one business day of handling. There is no invented carrier transit duration. Returns use the owner's 90-day window and customer-paid return postage; unconfirmed restocking fees and item-condition restrictions are omitted.

Current sources consulted November 1, 2026:

- https://support.google.com/merchants/answer/6386198 — bulk pricing uses the total minimum purchasable quantity.
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing — one Offer, availability, and cross-page policy references.
- https://developers.google.com/search/docs/appearance/structured-data/shipping-policy — ShippingService, orderValue boundaries and handling duration.
- https://developers.google.com/search/docs/appearance/structured-data/return-policy — finite return window and ReturnFeesCustomerResponsibility.

Validation covers minimum cable orders, bolt packs, cutter units, active sale prices, unknown/out-of-stock and partial stock, shipping boundaries, public image URLs, and prohibited fabricated identifiers. The production build verifies all generated JSON-LD, canonicals and sitemap coverage. Google Rich Results Test is run after deployment. Merchant Center account/feed settings are not changed by this code; any submitted product prices must use the same minimum-order price and pack definition, and account-level policy settings can override website markup.
