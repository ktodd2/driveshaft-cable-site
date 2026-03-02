---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/components/newsletter/NewsletterModal.jsx
type: component
updated: 2026-03-02
status: active
---

# NewsletterModal.jsx

## Purpose

Exit-intent modal that captures newsletter signups when users move their cursor toward closing the browser tab. Implements a 5-second arming delay and localStorage persistence to avoid showing to users who have already dismissed or subscribed.

## Exports

- `NewsletterModal` (default): React component that renders a modal overlay with newsletter signup form triggered by exit intent

## Dependencies

- [[users-kurtistodd-driveshaft-cable-site-3-src-components-newsletter-newsletterform]]: Reusable newsletter form component
- react: useState, useEffect hooks

## Used By

TBD

## Notes

- Uses `ktodd-newsletter-modal-dismissed` localStorage key to track dismissal state
- Exit intent detection triggers when `clientY <= 0` (mouse leaves top of viewport)
- Modal auto-closes 2 seconds after successful subscription to show success message
- Passes `source="exit_intent"` to NewsletterForm for analytics tracking