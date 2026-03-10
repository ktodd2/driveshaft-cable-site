---
path: /Users/kurtistodd/driveshaft-cable-site-3/supabase/functions/generate-blog-post/index.ts
type: api
updated: 2026-03-10
status: active
---

# index.ts

## Purpose

Supabase Edge Function that generates SEO-optimized blog posts for the heavy duty towing industry using AI. It selects from predefined topic seeds, generates content via Claude API, and stores published posts in the database.

## Exports

None (Edge Function entry point using `serve`)

## Dependencies

- https://deno.land/std@0.168.0/http/server.ts (Deno HTTP server)
- https://esm.sh/@supabase/supabase-js@2 (Supabase client)
- Anthropic Claude API (external service for content generation)

## Used By

TBD

## Notes

- Contains 30+ topic seeds across categories: safety, driveline, tips, regulations, equipment, industry-news
- Uses CORS headers for cross-origin access
- Requires environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
- Blog posts include SEO metadata (meta_description, keywords, og_image_prompt)
- Implements topic rotation to avoid duplicate content