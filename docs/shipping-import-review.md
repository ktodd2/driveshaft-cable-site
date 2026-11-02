# Pirate Ship automatic cost import

## Current workflow

The admin chooses a CSV or XLSX file. Upload immediately validates and parses it, reloads the complete orders and receipt history, matches safe rows, and saves missing actual shipping costs. There is no preview/save wizard, bulk confirmation, tracking selector or per-row matching form. The result shows orders updated, already recorded, and only exceptions needing attention. Recent successful imports remain available under a collapsed history section.

The implementation was built from main `8f456fd` on `feature/shipping-upload-auto`. It preserves the unrelated SEO, review, profit-reporting and admin work on that base. No production import or order mutation was used for testing. Publication is pending parent review.

## Actual formats inspected

The local historical Pirate Ship `Transactions.xlsx` archive (November 1 export) has exactly `Date, Type, Description, Total, Balance`, 542 data rows and Label, Payment, Pickup, Refund and Pickup Refund transaction types. Dates use `10/29/26 10:40 PM CDT`; label descriptions end in `: 1 Label Batch`. It contains no email, tracking number or order reference. The old local importer matched names after removing punctuation; this implementation does **not** do that. The checked-in CSV fixture reproduces those columns using synthetic recipients only.

Existing generic CSV/XLSX support for recipient name, email, tracking and cost remains. No speculative order-reference columns or external shipping service have been introduced.

## Automatic matching and exclusions

- A unique exact tracking match can save when any supplied name/email also agree.
- A unique exact name **and** email match can save when source tracking does not conflict with stored tracking.
- The observed name-only ledger can save only when the trimmed, case-insensitive recipient name matches exactly one order across the full order list, only one single-label transaction exists for that recipient, and its explicit CST/CDT timestamp falls after order creation, within 30 days, and not in the future. The date window is a conservative heuristic, not proof of identity; any repeat customer/order or multi-label batch is excluded. No fuzzy matching, punctuation stripping, nearest-date selection, or newest-order selection.
- All automatic targets must be paid, confirmed/shipped/delivered, and not flagged test/refunded/cancelled by the existing eligibility helper. Orders are not filtered before ambiguity checking.
- Only missing (`null`) actual costs are written. Equal recorded costs are noops. Differing actual costs—including real zero—are exceptions. A new zero is valid. The $15 reporting fallback is not consulted or recorded.
- Identical repeated file rows are counted once. Conflicting duplicate costs or reversals block the source. Refund/void handling from the original parser remains conservative; no refund arithmetic is performed.
- Multiple shipments to one order, previously imported orders receiving a new label, and unresolved rows that could belong to an otherwise matched order are exceptions. No partial total or incremental addition is guessed.
- Receipt source hashes are unchanged. Reuploads skip identical recorded labels; changed receipt costs/current order values become exceptions. Anonymous ledger fingerprints cannot identify a changed export across different formats, but existing-cost and multiple-row guards prevent silently adding costs.

## Storage, safety and release scope

**No migration, new table, RPC, RLS or grant changes.** The existing `apply_shipping_import` RPC and `shipping_import_receipts`/`shipping_import_sources` remain unchanged, including active-admin checks, transaction/row locks, unique source keys, atomic receipts and null-safe expected-cost/tracking checks.

Every automatic RPC call passes existing tracking unchanged. It saves actual cost and advances `updated_at`; it never changes carrier/status or invokes an email function. Concurrent cost/tracking changes fail inside the existing RPC. Concurrent unrelated order field changes are not version-locked by that RPC. Source IDs and all previous receipts remain intact.

The parser completes before writes start. Full paginated reads must succeed before a plan runs. Per-order failures appear in the summary; other safe orders may finish. If a response is lost after a commit, uploading the same file again discovers the receipt and avoids applying it twice. A ref guard and disabled upload input prevent overlapping uploads in one mounted panel.

Successful receipt history persists. Exceptions remain session-only and are shown directly below the summary; Needs attention still reports unmatched imports as **Not saved**, not a persistent queue. Correct the source or inspect the linked order, then upload again.

Release scope is frontend/parser orchestration + tests/docs only. Review before publishing. Reverting the frontend does not remove receipts or undo actual costs already saved; no database rollback is needed.

## Validation

- 261 tests passed (current-main suite plus 11 automatic-import tests).
- Unchanged migration applied to ephemeral PGlite: authorization/RLS, source replay, stale values, rollback/retry; additionally ran the new automatic planner through the actual SQL function for zero costs, repeat upload and concurrent edits.
- Headless desktop/mobile QA at 1440px/390px: upload immediately saves safe fixture rows, no wizard controls, same-file repeat, zero, ambiguity, existing-cost conflict, response loss, concurrent edit, malformed CSV/XLSX, valid XLSX, and failed history reads. Backend requests are mocked; no live orders/emails.
- Vite + prerender + sitemap + generated-page verification passed using a local fixture snapshot (11 public pages). Plain `npm run build` requires production public-catalog configuration under current main; no private credentials were copied into this checkout.
- `npm run routes:check`: 32 routes. `git diff --check`: clean.

Run the integration scripts with `PGLITE_MODULE` / `PLAYWRIGHT_MODULE` pointing at temporary test dependencies. Browser QA uses localhost port 4178 with fake Supabase and Stripe configuration, and writes screenshot artifacts under `qa/shipping-auto/`.
