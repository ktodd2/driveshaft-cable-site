-- Email campaign send log (audit trail for each blast)
CREATE TABLE email_campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE email_campaign_sends ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Allow authenticated full access" ON email_campaign_sends
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
