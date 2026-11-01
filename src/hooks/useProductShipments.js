import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { readAttentionRows } from '../lib/needsAttention'
import { calcWeightedAvgCost, calcWeightedAvgCostByProduct } from '../lib/costCalculations'

export function useProductShipments() {
  const [shipments, setShipments] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchShipments = async () => {
    setLoading(true)
    setError(null)
    try { setShipments((await readAttentionRows(supabase, 'product_shipments')).sort((a,b) => Date.parse(b.received_at) - Date.parse(a.received_at))) }
    catch { setShipments([]); setError('Product costs unavailable') }
    setLoading(false)
  }

  useEffect(() => { fetchShipments() }, [])

  // Global weighted average across all products — kept for any caller that
  // hasn't been refactored to use the per-product map yet.
  const avgCostPerUnit = calcWeightedAvgCost(shipments)

  // Per-product weighted averages: { '1': 200, '2': 220, ... }
  const avgCostPerUnitByProduct = calcWeightedAvgCostByProduct(shipments)

  const addShipment = async ({ productId, quantity, totalCostCents, supplierName, notes }) => {
    if (!productId) return { error: new Error('productId is required for new shipments') }
    const { error } = await supabase
      .from('product_shipments')
      .insert([{
        product_id: productId,
        quantity,
        total_cost_cents: totalCostCents,
        supplier_name: supplierName || null,
        notes: notes || null,
      }])
    if (!error) {
      await fetchShipments()
      // Auto-increment inventory atomically for the shipment's product.
      await supabase.rpc('increment_stock', { p_product_id: productId, p_quantity: quantity })
    }
    return { error }
  }

  const deleteShipment = async (id) => {
    const { error } = await supabase
      .from('product_shipments')
      .delete()
      .eq('id', id)
    if (!error) await fetchShipments()
    return { error }
  }

  return {
    shipments,
    error,
    loading,
    avgCostPerUnit,
    avgCostPerUnitByProduct,
    addShipment,
    deleteShipment,
    refetch: fetchShipments,
  }
}
