# Public Referral Program page — draft review

Proposed URL: `/referrals`. Header navigation: **Referrals** on desktop and in the mobile menu; footer: **Referral Program**. This is an information page with email/DM signup instructions, not a public enrollment form.

The dark industrial typography, orange/gold accents, caution stripe, cards and button styles reuse the existing site branding. The four earning tiers appear as accessible text rather than text inside a graphic.

## Terms checked

Read-only production schema defaults confirm 5% buyer discount and reward rates of 10% / 5% / 2% / 1% through orders 1 / 2 / 10 / 20. The unchanged application policy returns 1% for order 20 and 0% for order 21. The page explicitly states the default schedule ends after 20, without an extra after-20 chart row. Code-specific settings can vary.

Past customers can request a code through kurtis@k-todd.com or DM Kurtis. Their first-time buyer enters the code at the first paid website retail checkout and verifies email. Rewards use merchandise after discounts, excluding tax/shipping; $100 reward balance gives $100 product credit or a $50 check, with product shipping from that same balance. Seven-day eligibility, refunds, monthly owner approval and settings changes are summarized accurately.

No payout math, checkout logic, customer data, permissions, emails, subscriptions, campaigns or provider settings changed. No signup or message was submitted during validation. This branch must remain a **draft PR, unmerged and undeployed**, pending owner review.

## Validation

- 360 existing unit checks pass; route inventory covers all 36 declared routes.
- Fixture Vite build and prerender pass; 11 canonical pages, including /referrals, have complete initial HTML and sitemap coverage.
- Isolated headless Chrome at 320, 390, 640, 768, 1024, 1280 and 1440 CSS pixels: terms and four rates, cash/product wording, contact-only signup, visible focus, Escape/focus recovery, desktop/mobile navigation, header clearance, no horizontal overflow, canonical/indexing, no page errors and 0 mutations.
- 640 CSS pixels checks narrow reflow equivalent to a 1280 CSS pixel layout at 200%; no claim of manual browser-zoom or screen-reader testing.
- Body and accent/CTA contrast measured 8.04:1 or better for the checked combinations (normal text minimum 4.5:1).
- Private invitation signup remains separate and noindex; public /referrals is indexable.

Screenshots: [Desktop](screenshots/desktop.png) · [Mobile](screenshots/mobile.png). Generated from fixture data; no customer information.

## Accessibility review

Scoped WCAG 2.1 AA review of the new content/navigation found no blocking issue in the tested paths. One h1, ordered steps, labeled sections and a definition list convey structure. New links have visible focus and 44 px minimum targets. Referrals navigation supports Enter; the mobile menu supports Escape and restores focus. Main content clears the fixed header at all tested widths. Rates and reward values are readable text.

| Checked combination | Contrast |
|---|---:|
| Body #D6D5CF on #111111 |12.84:1|
| Gold #FFBE2E on #151515 |11.01:1|
| Link/label #FFD159 on #171207 |12.89:1|
| Black CTA on orange #FF7A00 |8.04:1|
| Black CTA on gold #F2A900 |10.45:1|

Manual VoiceOver/NVDA testing was not performed. This is a scoped review, not a full-site accessibility certification.

## Rollout and rollback

No backend dependency or migration. If approved later, merging the reviewed frontend branch would use the existing normal deployment pipeline. Revert this frontend change to remove the page/navigation/sitemap entry; existing referral checkout and rewards remain independent. Do not deploy fixture builds.
