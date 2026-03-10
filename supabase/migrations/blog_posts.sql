-- Blog posts table for automated towing & recovery content
CREATE TABLE blog_posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  topic_seed TEXT,
  meta_description TEXT,
  reading_time_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX idx_blog_posts_listing ON blog_posts (status, published_at DESC);
CREATE INDEX idx_blog_posts_category ON blog_posts (category);

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts
CREATE POLICY "Public read published posts" ON blog_posts
  FOR SELECT TO anon
  USING (status = 'published');

-- Authenticated (admin) can read all posts
CREATE POLICY "Authenticated read all posts" ON blog_posts
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated (admin) can insert/update/delete
CREATE POLICY "Authenticated insert posts" ON blog_posts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update posts" ON blog_posts
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete posts" ON blog_posts
  FOR DELETE TO authenticated
  USING (true);
