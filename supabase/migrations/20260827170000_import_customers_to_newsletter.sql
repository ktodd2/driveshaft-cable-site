-- Import past paying customers into the newsletter list.
--
-- Every distinct email with a paid order becomes an active, confirmed
-- subscriber: these are real customers with an existing business
-- relationship, so no double-opt-in confirmation email is required
-- (unlike form signups). They enter at welcome_stage = 3 so the
-- new-subscriber welcome drip (WELCOME5 / "thanks for signing up") never
-- targets them — they simply receive campaigns from here on.
--
-- Rules:
--   - anyone who previously unsubscribed stays unsubscribed;
--   - a customer already on the list (including rows purged by
--     20260827160000) is reactivated, keeping their original source and
--     any earlier confirmed_at;
--   - re-running is a no-op for rows already active.

INSERT INTO newsletter_subscribers
  (email, source, status, confirmed, confirmed_at, welcome_stage, subscribed_at)
SELECT DISTINCT
  LOWER(TRIM(o.email)), 'customer-import', 'active', TRUE, NOW(), 3, NOW()
FROM orders o
WHERE o.payment_status = 'paid'
  AND o.email IS NOT NULL
  AND TRIM(o.email) <> ''
ON CONFLICT (email) DO UPDATE
  SET status = 'active',
      confirmed = TRUE,
      confirmed_at = COALESCE(newsletter_subscribers.confirmed_at, NOW()),
      welcome_stage = 3,
      unsubscribed_at = NULL
  WHERE newsletter_subscribers.status <> 'unsubscribed';
