import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Returns inventory rows for every product in one query. Used by admin
// pages that need to show stock for an arbitrary number of products.
export function useAllInventory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('product_inventory')
      .select('product_id, stock_quantity, total_quantity')
    if (error) {
      console.error('useAllInventory: fetch failed', error)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const inventoryMap = {}
  for (const r of rows) {
    inventoryMap[r.product_id] = { stock: r.stock_quantity, totalStock: r.total_quantity }
  }

  return { rows, inventoryMap, loading, refetch: fetchAll }
}

export function useInventory(productId = '1') {
  const [stock, setStock] = useState(null)
  const [totalStock, setTotalStock] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStock = async () => {
    const { data, error } = await supabase
      .from('product_inventory')
      .select('stock_quantity, total_quantity')
      .eq('product_id', productId)
      .single()

    if (error) {
      console.error('Error fetching inventory:', error)
      setStock(null)
      setTotalStock(null)
    } else {
      setStock(data.stock_quantity)
      setTotalStock(data.total_quantity ?? null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStock()
  }, [productId])

  return { stock, totalStock, loading, refetch: fetchStock }
}

export async function updateStock(productId, newQuantity) {
  const { error } = await supabase
    .from('product_inventory')
    .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq('product_id', productId)

  return { error }
}
