const ORIGIN = 'https://driveshaftcable.com'
export const STATIC_PUBLIC_PATHS = ['/', '/products', '/about', '/faq', '/instructions', '/contact', '/quote', '/blog', '/shipping-returns']
const isPublicPath = path => STATIC_PUBLIC_PATHS.includes(path) || /^\/(products|blog)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
export function lastModified(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp <= now ? new Date(timestamp).toISOString() : null
}
const latest = values => values.filter(Boolean).sort().at(-1) || null

// Reuse the exact public catalog/editorial snapshot that generated the HTML.
// Do not manufacture a date for static content whose edit history isn't known.
export function sitemapEntries(data, paths) {
  const productDate = latest(data.products.map(p => lastModified(p.updated_at)))
  const postDate = latest(data.posts.map(p => lastModified(p.updated_at || p.published_at)))
  return paths.map(path => {
    const product = data.products.find(p => path === `/products/${p.slug}`)
    const post = data.posts.find(p => path === `/blog/${p.slug}`)
    const modified = product?.updated_at || post?.updated_at || post?.published_at ||
      (['/', '/products'].includes(path) ? productDate : path === '/blog' ? postDate : null)
    return { path, lastmod: lastModified(modified), images: product?.images || [] }
  })
}
export function buildSitemap(entries, { now = Date.now() } = {}) {
  const unique = new Map()
  for (const entry of entries) {
    if (!isPublicPath(entry.path) || entry.path === '/products/driveshaft-cable-plus') continue
    const previous = unique.get(entry.path)
    unique.set(entry.path, {
      path: entry.path,
      lastmod: latest([previous?.lastmod, lastModified(entry.lastmod, now)]),
      images: [...new Set([...(previous?.images || []), ...(Array.isArray(entry.images) ? entry.images : [])])],
    })
  }
  const urls = [...unique.values()].map(entry => {
    const images = entry.images.flatMap(image => {
      if (typeof image !== 'string' || !image.trim()) return []
      try {
        const url = new URL(image, ORIGIN)
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? [`    <image:image><image:loc>${escapeXml(url.href)}</image:loc></image:image>`] : []
      } catch { return [] }
    })
    return ['  <url>', `    <loc>${escapeXml(ORIGIN + entry.path)}</loc>`,
      entry.lastmod && `    <lastmod>${entry.lastmod}</lastmod>`, ...images, '  </url>'].filter(Boolean).join('\n')
  })
  if (!urls.length || urls.length > 50000) throw new Error('Invalid sitemap URL count')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`
}
