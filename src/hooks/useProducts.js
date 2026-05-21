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
  const addProduct = async ({ id, name, sku, basePriceCents, tiers, isStorefront = false, sortOrder = 0 }) => {
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
      ...(patch.name !== undefined        && { name: patch.name }),
      ...(patch.sku !== undefined         && { sku: patch.sku }),
      ...(patch.basePriceCents !== undefined && { base_price_cents: patch.basePriceCents }),
      ...(patch.tiers !== undefined       && { tiers: patch.tiers }),
      ...(patch.isActive !== undefined    && { is_active: patch.isActive }),
      ...(patch.isStorefront !== undefined && { is_storefront: patch.isStorefront }),
      ...(patch.sortOrder !== undefined   && { sort_order: patch.sortOrder }),
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
