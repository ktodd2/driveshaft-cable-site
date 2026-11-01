// Generate once from the same snapshot as the published public HTML. This
// discovers new storefront products and published articles on every deployment.
import { readFile, writeFile } from 'node:fs/promises'
import { buildSitemap } from './sitemap-helpers.mjs'

const manifest = JSON.parse(await readFile(new URL('../dist/prerender-manifest.json', import.meta.url), 'utf8'))
if (!Array.isArray(manifest.sitemapEntries) || manifest.sitemapEntries.length !== manifest.paths?.length) {
  throw new Error('A complete public-page manifest is required before generating the sitemap')
}
const xml = buildSitemap(manifest.sitemapEntries)
await writeFile(new URL('../dist/sitemap.xml', import.meta.url), xml)
console.log(`[sitemap] Generated ${manifest.paths.length} canonical public URLs, including all active storefront products`)
