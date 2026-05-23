import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Module-level cache so multiple components don't all refetch simultaneously
// on first mount. The cache invalidates when any mutation runs.
let cachedProducts = null
let inFlightFetch = null

async function fetchAllProducts() {
  if (inFlightFetch) return inFlightFetch
  inFlightFetch = supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .then(({ data, error }) => {
      inFlightFetch = null
      if (error) {
        console.error('useProducts: fetch failed', error)
        return []
      }
      cachedProducts = data || []
      return cachedProducts
    })
  return inFlightFetch
}

function buildMap(products) {
  const map = {}
  for (const p of products) map[p.id] = p
  return map
}

export function useProducts() {
  const [products, setProducts] = useState(cachedProducts || [])
  const [loading, setLoading] = useState(!cachedProducts)

  const refetch = useCallback(async () => {
    setLoading(true)
    cachedProducts = null
    const data = await fetchAllProducts()
    setProducts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (cachedProducts) {
      setProducts(cachedProducts)
      setLoading(false)
      return
    }
    let cancelled = false
    fetchAllProducts().then(data => {
      if (!cancelled) {
        setProducts(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const productsMap = buildMap(products)
  const activeProducts = products.filter(p => p.is_active)

  // Mutations — each invalidates the cache so the next refetch hits the DB.
  const addProduct = async (input) => {
    const {
      id, name, sku, basePriceCents, tiers,
      isStorefront = false, sortOrder = 0,
      // Phase 2 storefront-content fields. All optional on add; the
      // admin form may save them empty and fill in later.
      slug, shortDescription, description, specs, applications, features,
      images, tagline, showcaseBullets, ctaLabel,
    } = input
    const { error } = await supabase
      .from('products')
      .insert([{
        id,
        name,
        sku,
        base_price_cents: basePriceCents,
        tiers,
        is_active: true,
        is_storefront: isStorefront,
        sort_order: sortOrder,
        slug,
        short_description: shortDescription ?? null,
        description: description ?? null,
        specs: specs ?? {},
        applications: applications ?? [],
        features: features ?? [],
        images: images ?? [],
        tagline: tagline ?? null,
        showcase_bullets: showcaseBullets ?? [],
        cta_label: ctaLabel ?? null,
      }])
    if (error) return { error }

    // Ensure inventory row exists so admin tooling and stock checks work.
    await supabase
      .from('product_inventory')
      .upsert(
        { product_id: id, stock_quantity: 0, total_quantity: 0, updated_at: new Date().toISOString() },
        { onConflict: 'product_id', ignoreDuplicates: true }
      )

    await refetch()
    return { error: null }
  }

  const updateProduct = async (id, patch) => {
    const dbPatch = {
      ...(patch.name !== undefined            && { name: patch.name }),
      ...(patch.sku !== undefined             && { sku: patch.sku }),
      ...(patch.basePriceCents !== undefined  && { base_price_cents: patch.basePriceCents }),
      ...(patch.tiers !== undefined           && { tiers: patch.tiers }),
      ...(patch.isActive !== undefined        && { is_active: patch.isActive }),
      ...(patch.isStorefront !== undefined    && { is_storefront: patch.isStorefront }),
      ...(patch.sortOrder !== undefined       && { sort_order: patch.sortOrder }),
      // Phase 2 fields — only included if the caller explicitly sets them.
      ...(patch.slug !== undefined             && { slug: patch.slug }),
      ...(patch.shortDescription !== undefined && { short_description: patch.shortDescription }),
      ...(patch.description !== undefined      && { description: patch.description }),
      ...(patch.specs !== undefined            && { specs: patch.specs }),
      ...(patch.applications !== undefined     && { applications: patch.applications }),
      ...(patch.features !== undefined         && { features: patch.features }),
      ...(patch.images !== undefined           && { images: patch.images }),
      ...(patch.tagline !== undefined          && { tagline: patch.tagline }),
      ...(patch.showcaseBullets !== undefined  && { showcase_bullets: patch.showcaseBullets }),
      ...(patch.ctaLabel !== undefined         && { cta_label: patch.ctaLabel }),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('products').update(dbPatch).eq('id', id)
    if (!error) await refetch()
    return { error }
  }

  const deleteProduct = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (!error) await refetch()
    return { error }
  }

  return {
    products,
    productsMap,
    activeProducts,
    loading,
    refetch,
    addProduct,
    updateProduct,
    deleteProduct,
  }
}
