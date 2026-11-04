# Past-customer search

Admin → Referral rewards → Add a past customer now offers a searchable combobox of actual recorded past paid customers. Search by name or email, select a result, then review the prefilled name/email and custom or generated code. Selecting sends nothing; adding a referrer and sending an invitation remain separate explicit actions.

The private search uses paid, refunded and partially refunded order history, one entry per trimmed/lowercase email. It retains a recent recorded name (or company when no name is recorded), and excludes identifiable test/synthetic statuses or payment methods and reserved fake email domains. Creation validates the same history predicate. No historical rewards, orders or attribution are changed. Legacy payment flags are trusted history; this is not a new provider audit of old payments.

The server filters before a fixed 25-row page and uses an email cursor, so every match is reachable beyond the API's ordinary first-1000 limit. Name/email matching treats percent and underscore literally. Browser responses contain only name/email and a continuation cursor. No order IDs, addresses, phones or financial data are returned.

Both the Edge route and service-only database RPC require an active admin. The actor comes from the verified session, never the request body. No public table grants or security-definer function are added. Contacts are fetched on demand, not embedded in static builds, browser storage or screenshots of real customers.

The widget debounces requests, discards stale results, supports Arrow/Enter/Escape and accessible loading/error states, and offers Load more. Choosing a new search clears the previous selected identity. Missing names can be filled by the owner before adding the referrer.

Validation: all 357 unit checks; actual SQL with 1,011 eligible fixture customers including pagination beyond1,000, case collisions, refunds, test exclusion, literal search and role rejection; Deno frozen-lock check; frontend/prerender/sitemap build with public fixtures; isolated headless desktop/mobile picker and full referral-form regressions all pass. Independent review repeated the SQL and all four endpoint tests with no blocking source findings. Screenshot fixtures are synthetic: past-customers-1440.png and past-customers-390.png.

Independent production-source SHA-256:

- Migration: 9bd7d596ef3444785db0c1c3af9db8652e32e7d95def8cbb2b079ef6ab8745aa
- referral-admin/index.ts: 266e18d17cdedce7ea191de558ff7b2c18b75882aba8c251467c144f0c473138
- PastCustomerPicker.jsx: 4cbe5cfa0db23377e7f985eeccb35728fd25baf55b901e215d781d8e75055fd3
- ReferralRewards.jsx: 75fb312c2b09801f7eb81baee71add7c2e4682e9b2a88be8cb0fbd69482ce4bb
