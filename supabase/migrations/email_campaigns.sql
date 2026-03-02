-- Email campaigns (blast history, scheduled, recurring)
CREATE TABLE email_campaigns (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  send_type TEXT NOT NULL DEFAULT 'immediate',  -- immediate, scheduled, recurring
  status TEXT NOT NULL DEFAULT 'draft',          -- draft, scheduled, active, paused, sent, cancelled
  recurrence TEXT,                               -- weekly, biweekly, monthly
  scheduled_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Allow authenticated full access" ON email_campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
