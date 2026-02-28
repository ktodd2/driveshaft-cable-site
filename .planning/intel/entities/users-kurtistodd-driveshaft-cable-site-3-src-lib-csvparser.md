---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/lib/csvParser.js
type: util
updated: 2026-02-28
status: active
---

# csvParser.js

## Purpose

Parses Pirate Ship shipping export files (CSV or XLSX) and matches shipment rows to existing orders by tracking number or customer name/email. Returns matched orders with shipping costs for variable cost tracking.

## Exports

- `parsePirateShipFile(file, orders)` - Main parser that auto-detects file type and returns matched/unmatched/errors
- `parsePirateShipCSV` - Alias for backwards compatibility (points to parsePirateShipFile)

## Dependencies

- papaparse (external) - CSV parsing library
- read-excel-file/browser (external) - XLSX parsing library

## Used By

TBD

## Notes

- Supports multiple cost column names: Total, Cost, Postage, Ship Cost, Amount, Label Cost, Shipping Cost
- Supports multiple tracking column names: Tracking Number, Tracking, Tracking #
- Two matching strategies: by tracking number first, then by normalized name+email combination
- Costs are converted from dollars to cents (integer) for storage
- Row numbers in errors/unmatched are 1-indexed with header offset (index + 2)