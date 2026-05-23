import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Storefront-facing product list. Returns only products that are both
// is_active AND is_storefront, ordered by sort_order. Used by
// ProductListPage and ProductShowcase. Module-level cache so the second
// component to mount doesn't re-fetch.

let cached = null
let inFlight = null

export function invalidateStorefrontProductsCache() {
  cached = null
}

async function fetchAll() {
  if (inFlight) return inFlight
  inFlight = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('is_storefront', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .then(({ data, error }) => {
      inFlight = null
      if (error) {
        console.error('useStorefrontProducts: fetch failed', error)
        return []
      }
      cached = data || []
      return cached
    })
  return inFlight
}

export function useStorefrontProducts() {
  const [products, setProducts] = useState(cached || [])
  const [loading, setLoading] = useState(!cached)

  const refetch = useCallback(async () => {
    setLoading(true)
    cached = null
    const data = await fetchAll()
    setProducts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (cached) {
      setProducts(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    fetchAll().then(data => {
      if (!cancelled) {
        setProducts(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  return { products, loading, refetch }
}
