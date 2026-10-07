// Post-build step: appends every published blog post to dist/sitemap.xml.
// The static pages live in public/sitemap.xml (copied into dist/ by Vite);
// this only adds the Supabase-backed /blog/:slug entries. If the Supabase
// env vars are missing or the fetch fails, the static sitemap is left as-is
// so a Supabase outage never breaks a deploy.
import { readFile, writeFile } from 'node:fs/promises'
import { loadEnv } from 'vite'

const SITE_URL = 'https://driveshaftcable.com'
const SITEMAP_PATH = new URL('../dist/sitemap.xml', import.meta.url)

// loadEnv reads .env files and process.env (Render injects the vars there)
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key } = loadEnv('production', process.cwd(), 'VITE_')

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function fetchPublishedPosts() {
  const res = await fetch(
    `${url}/rest/v1/blog_posts?select=slug,updated_at,published_at&status=eq.published&order=published_at.desc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) throw new Error(`Supabase responded ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  if (!url || !key) {
    console.warn('[sitemap] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — skipping blog posts')
    return
  }

  let posts
  try {
    posts = await fetchPublishedPosts()
  } catch (err) {
    console.warn(`[sitemap] Could not fetch blog posts — skipping: ${err.message}`)
    return
  }

  const entries = posts
    .filter((p) => p.slug)
    .map((p) => {
      const lastmod = (p.updated_at || p.published_at || '').slice(0, 10)
      return [
        '  <url>',
        `    <loc>${SITE_URL}/blog/${escapeXml(encodeURIComponent(p.slug))}</loc>`,
        lastmod && `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.6</priority>',
        '  </url>',
      ].filter(Boolean).join('\n')
    })

  const sitemap = await readFile(SITEMAP_PATH, 'utf8')
  const output = sitemap.replace('</urlset>', `${entries.join('\n')}\n</urlset>`)
  await writeFile(SITEMAP_PATH, output)
  console.log(`[sitemap] Added ${entries.length} blog post(s) to dist/sitemap.xml`)
}

main()
