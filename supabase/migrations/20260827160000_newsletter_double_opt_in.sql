-- Double opt-in for newsletter signups + purge of the bot-filled subscriber list.
--
-- Background: the signup form inserted straight into newsletter_subscribers with
-- no verification, and the table allowed unconditional anonymous inserts. Bots
-- stuffed the list with junk addresses, and the welcome-series cron emailed all
-- of them (bounces + suppressions visible in Resend on 2026-08-27).
--
-- From this migration on, a subscriber only receives email after clicking a
-- confirmation link (confirmed = TRUE). Signups now go through the
-- newsletter-subscribe edge function; direct anonymous inserts are disabled.

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_token UUID,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

-- Token lookup for the confirm endpoint.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_confirmation_token_idx
  ON newsletter_subscribers (confirmation_token)
  WHERE confirmation_token IS NOT NULL;

-- Purge: every pre-existing subscriber predates double opt-in, so none of them
-- ever verified their address, and the list is known to be mostly bot signups
-- (none correspond to a paying customer). Mark them purged and finish their
-- welcome sequence so no automation ever emails them again. Rows are kept (not
-- deleted) so a real person on the list can simply re-subscribe through the
-- form and confirm; scripts/purge-junk-subscribers.sh offers an optional hard
-- delete of purged rows.
UPDATE newsletter_subscribers
   SET status = 'purged',
       welcome_stage = 3
 WHERE confirmed = FALSE
   AND status = 'active';

-- Close the door bots came through: signups now go through the
-- newsletter-subscribe edge function (service role), so the public no longer
-- writes to this table directly.
DROP POLICY IF EXISTS "Allow anonymous inserts" ON newsletter_subscribers;
