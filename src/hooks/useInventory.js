import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useInventory(productId = '1') {
  const [stock, setStock] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStock = async () => {
    const { data, error } = await supabase
      .from('product_inventory')
      .select('stock_quantity')
      .eq('product_id', productId)
      .single()

    if (error) {
      console.error('Error fetching inventory:', error)
      setStock(null)
    } else {
      setStock(data.stock_quantity)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStock()
  }, [productId])

  return { stock, loading, refetch: fetchStock }
}

export async function updateStock(productId, newQuantity) {
  const { error } = await supabase
    .from('product_inventory')
    .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq('product_id', productId)

  return { error }
}
