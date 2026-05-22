import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Admin CRUD wrapper around the `sales` table. Mirrors the shape of
// useProducts so the page-level UX is consistent. The storefront's cart
// store has its own loader; this hook is for the admin /admin/sales page.

let cachedSales = null
let inFlightFetch = null

async function fetchAllSales() {
  if (inFlightFetch) return inFlightFetch
  inFlightFetch = supabase
    .from('sales')
    .select('*')
    .order('starts_at', { ascending: false })
    .then(({ data, error }) => {
      inFlightFetch = null
      if (error) {
        console.error('useSales: fetch failed', error)
        return []
      }
      cachedSales = data || []
      return cachedSales
    })
  return inFlightFetch
}

export function useSales() {
  const [sales, setSales] = useState(cachedSales || [])
  const [loading, setLoading] = useState(!cachedSales)

  const refetch = useCallback(async () => {
    setLoading(true)
    cachedSales = null
    const data = await fetchAllSales()
    setSales(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (cachedSales) {
      setSales(cachedSales)
      setLoading(false)
      return
    }
    let cancelled = false
    fetchAllSales().then(data => {
      if (!cancelled) {
        setSales(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const addSale = async ({ name, discountPercent, scope, productId, startsAt, endsAt }) => {
    const { error } = await supabase
      .from('sales')
      .insert([{
        name,
        discount_percent: discountPercent,
        scope,
        product_id: scope === 'product' ? productId : null,
        starts_at: startsAt,
        ends_at: endsAt,
        is_active: true,
      }])
    if (!error) await refetch()
    return { error }
  }

  const updateSale = async (id, patch) => {
    const dbPatch = {
      ...(patch.name !== undefined            && { name: patch.name }),
      ...(patch.discountPercent !== undefined && { discount_percent: patch.discountPercent }),
      ...(patch.scope !== undefined           && { scope: patch.scope }),
      ...(patch.productId !== undefined       && { product_id: patch.productId }),
      ...(patch.startsAt !== undefined        && { starts_at: patch.startsAt }),
      ...(patch.endsAt !== undefined          && { ends_at: patch.endsAt }),
      ...(patch.isActive !== undefined        && { is_active: patch.isActive }),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('sales').update(dbPatch).eq('id', id)
    if (!error) await refetch()
    return { error }
  }

  const deleteSale = async (id) => {
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (!error) await refetch()
    return { error }
  }

  return { sales, loading, refetch, addSale, updateSale, deleteSale }
}
