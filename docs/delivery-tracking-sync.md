# Admin delivery tracking

`check-tracking-status` polls USPS and UPS and changes only paid, shipped orders with tracking numbers to delivered when the carrier supplies matching delivery evidence. It does not send email, SMS, or invoke delivery/marketing functions. It does not modify storefront code. The existing order record remains the shared source of truth for any existing consumers.

## Current deployment and blocker (2026-11-08)

The hardened function is deployed. The existing `check-tracking-twice-daily` cron job remains disabled, with its existing 09:00 and 17:00 UTC schedule and authentication unchanged. A live authenticated diagnostic returned HTTP 200 and reported `credentials_missing` for both carriers. The diagnostic and dry run changed no historical order statuses. A subsequent separate reconciliation against the owner’s Pirate Ship shipment export marked 148 exact-match delivered shipments as delivered, leaving 14 shipped orders. Delivery timestamps were not invented.

At initial inspection, 161 shipped orders had tracking (91 UPS, 70 USPS); one shipped order had no tracking. Already delivered, cancelled, refunded, unpaid, or untracked orders are never inferred into a different state. All current shipped orders have inventory already accounted for. Rows lacking `stock_decremented=true` are excluded to avoid the existing order-update inventory trigger causing unrelated inventory changes.

## Secure prerequisite

Configure the existing `USPS_CLIENT_ID`, `USPS_CLIENT_SECRET`, `UPS_CLIENT_ID`, and `UPS_CLIENT_SECRET` Edge Function secret names with approved production carrier credentials using Supabase's secure Secrets interface. Do not paste secrets into chat, source code, tickets, or logs. Account/app creation and persistent credential access require the owner's approval and carrier requirements. This change does not create credentials or purchase services.

## Verification and activation

1. Invoke the authenticated function with `{"diagnostics":true}`. Both carrier results must say `ready`; authentication rejection differs from missing credentials. The diagnostic writes only aggregate automation-run health metadata.
2. Invoke with `{"dryRun":true}` to review evidence for the oldest 200 eligible rows without changing orders. The response may contain order identifiers and must remain private.
3. Invoke with `{}` for the first catch-up, then review automation history and changed order counts. No customer messages are sent.
4. Enable only the existing tracking cron using `cron.alter_job` after access works. Do not run the global setup function: it manages unrelated email schedules.
5. Confirm a scheduled run completed at the Edge Function level. A successful pg_cron run alone confirms HTTP enqueueing, not carrier access or completed updates.

## Safety and limits

- Conditional updates match status, payment, stock flag, tracking number/carrier, update timestamp, previous check time, and previous delivery time. Concurrent edits/refunds/repeated workers cannot overwrite newer state or count a delivery twice.
- Missing credentials, unknown carriers, malformed responses, timeouts, identity mismatches, undeliverable/attempted delivery/returns never mark delivered.
- Delivery evidence requires an actual current delivery event date consistent with the order date, never an estimate. Existing timestamps are preserved. A timezone-free carrier date confirms the status but does not fabricate a precise `delivered_at` timestamp.
- Each run processes up to 200 least-recently checked rows with four workers, ten-second request timeouts and a 90-second work budget. Later runs resume oldest checks first.
- UPS tracking history is generally retained for 120 days. Expired history and missing tracking need manual verification; absence of evidence is not delivery.
- Automated delivery cannot yet be verified end-to-end because both carrier credentials are missing. The unit tests cover provider normalization, identity/date validation, negative delivery cases, timestamp preservation, and concurrency guards.

## Carrier access references

- USPS setup: https://developers.usps.com/getting-started
- USPS April 2026 access/MID rules: https://www.usps.com/business/api-access.htm
- For Pirate Ship labels, confirm USPS entitlement before provisioning access: https://emailus.usps.com/s/usps-APIs
- UPS Tracking app setup: https://developer.ups.com/get-started
- Pirate Ship has no API: https://support.pirateship.com/en/articles/2309246-does-pirate-ship-have-an-api
- A carrier-status shipment export may help reconcile history after inspecting its evidence fields: https://support.pirateship.com/en/articles/4143612-can-i-export-a-report-of-my-shipment-history

No carrier agreements, new accounts, paid services, or persistent access were created by this change.
