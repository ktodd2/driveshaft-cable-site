# Public page HTML generation

`npm run build` now runs Vite, the existing sitemap generator, and `scripts/prerender.mjs`.
The final step fetches only publicly readable active storefront products, their stock rows,
and published articles using the existing publishable key. React renders the public routes
with the same components used in the browser, extracting route-specific Helmet metadata.
The temporary server build is removed and is never part of `dist/`.

The output includes HTML for the homepage, shop, informational pages, product pages,
blog index and published posts. Explicit cart, checkout, tracking, and login routes retain
an empty client-rendered shell with noindex. No customer, identity, order or private admin
data enters the HTML payload. New product/post slugs are discovered on every build.

The browser hydrates with the exact public snapshot, restores the saved cart only after
hydration, and refreshes catalog, stock, sales and editorial data through existing queries.
Seeding prices before hydration must never write empty cart data to local storage.

## Freshness and publishing

The initial HTML is a deployment snapshot. Publish/redeploy after catalog, inventory or
editorial changes that should immediately appear in non-JavaScript responses and search
markup. The browser continues reading current prices, inventory and sales after loading;
server-side checkout remains authoritative. A new article or product added after a build
still loads through the SPA fallback, but gets its own initial HTML on the next deployment.
There is no new scheduled deployment, paid server, or credential added by this change.

Production prerendering fails the build on missing configuration, failed public queries,
empty catalog or incomplete pages rather than silently publishing loading screens.

## Verification

Run `npm test` and `npm run build`, then `node scripts/verify-prerender.mjs`.
The verifier checks every generated route's initial content, canonical, metadata and JSON-LD;
product pages must contain their own SKU and minimum quantity. It also checks that utility
pages have no public snapshot. Use browser QA for hydration, cart restoration, quantity
controls and client navigation; use plain HTTP to verify the deployed initial HTML.
Render serves existing generated resources before applying the wildcard SPA rewrite.
