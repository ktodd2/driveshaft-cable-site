# Public page HTML generation

`npm run build` runs Vite, `scripts/prerender.mjs`, the sitemap generator, and the generated-page verifier.
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

## Render routing

Product and article leaf pages are generated as extensionless HTML files at their
existing public URLs. Render's resource lookup then serves them before the SPA
fallback. Content-Type: text/html; charset=utf-8 is set only for /products/* and
/blog/*; these URL namespaces are reserved for HTML. The shop/blog indexes and
other known directory pages have explicit index.html rewrites before the original
fallback. The retired Plus redirect and empty utility shells are preserved.
New product/article slugs do not require manual route entries: generated files
resolve directly, and slugs created since the last build still use the SPA fallback.

## Sitemap

The sitemap is generated from the same filtered snapshot and public paths as the HTML.
Every active storefront product and published article is included once at its canonical
URL. Retired products, drafts, carts, checkout, tracking and admin pages are excluded.
Product image URLs come from the current public product records, without old brand labels.
Product/article lastmod values use actual database modification timestamps (falling back
to publication for posts). Catalog and blog indexes use the newest relevant record date.
Unknown dates on static pages are omitted; deployment time is never used as a fake edit date.
The build refuses to publish a sitemap that disagrees with its public-page manifest.

The initial product timestamp baseline was backfilled to the verified November 1,
2026 metadata publication time (20:21:43.426176 UTC) for the four active storefront
products. Their recent page/metadata corrections had not advanced record timestamps.
This is a historical correction, not an instruction to change dates on every build.
