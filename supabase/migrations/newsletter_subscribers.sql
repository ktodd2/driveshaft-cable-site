-- Newsletter subscribers
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT 'homepage',
  status TEXT DEFAULT 'active',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public signup)
CREATE POLICY "Allow anonymous inserts" ON newsletter_subscribers
  FOR INSERT TO anon WITH CHECK (true);

-- Allow authenticated users to read all (admin)
CREATE POLICY "Allow authenticated reads" ON newsletter_subscribers
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update (admin manage)
CREATE POLICY "Allow authenticated updates" ON newsletter_subscribers
  FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to delete (admin manage)
CREATE POLICY "Allow authenticated deletes" ON newsletter_subscribers
  FOR DELETE TO authenticated USING (true);
