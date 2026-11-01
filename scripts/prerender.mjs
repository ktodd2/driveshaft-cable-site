import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build, loadEnv } from 'vite'
import { pageDocument, routeFile } from './prerender-helpers.mjs'
import { STATIC_PUBLIC_PATHS, sitemapEntries } from './sitemap-helpers.mjs'

const root = process.cwd()
const env = loadEnv('production', root, 'VITE_')
const fixtureAt = process.argv.indexOf('--fixture')
if (process.env.RENDER === 'true' && fixtureAt !== -1) throw new Error('Fixture data cannot be deployed')
const shell = await readFile(resolve(root, 'dist/index.html'), 'utf8')
if (!shell.includes('<div id="root"></div>')) throw new Error('Prerender requires a fresh Vite build; run npm run build')
const fields = 'id,slug,name,sku,base_price_cents,tiers,min_order_quantity,order_quantity_step,short_description,description,specs,applications,features,images,tagline,showcase_bullets,cta_label,updated_at'
async function rows(table, params) {
  const all = []
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({ ...params, limit: '1000', offset: String(offset) })
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(20000), redirect: 'error',
    })
    if (!response.ok) throw new Error(`Public ${table} fetch failed (${response.status}); refusing partial prerender`)
    const batch = await response.json()
    if (!Array.isArray(batch)) throw new Error(`Invalid public ${table} response`)
    all.push(...batch)
    if (batch.length < 1000) return all
  }
}
async function loadPublicData() {
  if (fixtureAt !== -1) return JSON.parse(await readFile(process.argv[fixtureAt + 1], 'utf8'))
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Public catalog configuration is required for prerendering')
  const products = await rows('products', { select: fields, is_active: 'eq.true', is_storefront: 'eq.true', order: 'sort_order.asc,id.asc' })
  if (!products.length) throw new Error('Public catalog is empty; refusing partial prerender')
  const [inventory, posts] = await Promise.all([
    rows('product_inventory', { select: 'product_id,stock_quantity,total_quantity', product_id: `in.(${products.map(p => p.id).join(',')})` }),
    rows('blog_posts', { select: 'id,title,slug,excerpt,content,category,tags,meta_description,published_at,updated_at,reading_time_minutes', status: 'eq.published', order: 'published_at.desc' }),
  ])
  return { products, inventory, posts }
}
const data = await loadPublicData()
const rendererDir = resolve(root, '.prerender')
try {
  await build({ build: { ssr: 'src/entry-server.jsx', outDir: rendererDir, emptyOutDir: true }, ssr: { noExternal: ['react-helmet-async'] } })
  const { renderPage } = await import(pathToFileURL(resolve(rendererDir, 'entry-server.js')))
  // Only marketing/catalog/editorial pages. Never snapshot carts, auth, tracking or orders.
  const paths = [...STATIC_PUBLIC_PATHS,
    ...data.products.map(p => `/products/${p.slug}`), ...data.posts.map(p => `/blog/${p.slug}`)]
  const blogPosts = data.posts.slice(0, 13).map(({ content, ...post }) => post)
  // Preserve the ordinary SPA shell for explicitly private/interactive utility routes.
  const privateShell = shell.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>')
  for (const path of ['/cart', '/checkout', '/checkout/success', '/order-tracking', '/suggestions', '/testimonial', '/admin', '/admin/login']) {
    const output = resolve(root, 'dist', routeFile(path))
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, privateShell)
  }
  for (const path of paths) {
    const post = path.startsWith('/blog/') ? data.posts.find(post => `/blog/${post.slug}` === path) : null
    const initial = { path, products: data.products, inventory: data.inventory,
      ...(path === '/blog' ? { blogPosts } : {}),
      ...(post ? { post, relatedPosts: blogPosts.filter(p => p.category === post.category && p.id !== post.id).slice(0, 3) } : {}) }
    const rendered = renderPage(path, initial)
    if (!rendered.html.includes('<h1') || !rendered.head.includes('rel="canonical"')) throw new Error(`Incomplete public page: ${path}`)
    const output = resolve(root, 'dist', routeFile(path))
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, pageDocument(shell, rendered, initial))
  }
  await writeFile(resolve(root, 'dist/prerender-manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), paths, sitemapEntries: sitemapEntries(data, paths) }, null, 2))
  console.log(`[prerender] Generated ${paths.length} complete public pages`)
} finally {
  await rm(rendererDir, { recursive: true, force: true })
}
