-- Backfill welcome_stage for subscribers who pre-date the email-automation
-- system. Without this, the 15-minute welcome-series cron would treat every
-- pre-existing subscriber as brand new and email them all 3 stages.
--
-- A test invocation of send-welcome-series ALREADY sent Day 0 to all 7
-- pre-existing subscribers (one-time mistake during setup; their stage is
-- now 1). Bumping all stage=1 rows to stage=3 stops the Day 3 + Day 7
-- emails from following. Subscribers added AFTER this migration will start
-- at stage=0 and flow through the series normally.

UPDATE newsletter_subscribers
SET welcome_stage = 3
WHERE welcome_stage IN (0, 1, 2);
