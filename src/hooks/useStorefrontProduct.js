import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Single storefront product fetched by slug, used by ProductDetailPage.
// Returns { product, loading, notFound } so the page can render a clean
// 404 state vs a loading skeleton.
export function useStorefrontProduct(slug) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      setNotFound(true)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .eq('is_storefront', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('useStorefrontProduct: fetch failed', error)
          setProduct(null)
          setNotFound(true)
        } else if (!data) {
          setProduct(null)
          setNotFound(true)
        } else {
          setProduct(data)
          setNotFound(false)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug])

  return { product, loading, notFound }
}
