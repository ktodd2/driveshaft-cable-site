-- Remove a mislabeled, unrelated external resource from one published article.
-- The NTSA destination represents training/simulation, not a towing regulator.
UPDATE public.blog_posts
SET content = replace(content, '- [National Towing Safety Administration](https://www.ntsa.org)', ''),
    updated_at = now()
WHERE slug = 'how-to-safely-recover-an-overturned-semi-truck'
  AND status = 'published'
  AND position('- [National Towing Safety Administration](https://www.ntsa.org)' in content) > 0;
