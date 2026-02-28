import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calcWeightedAvgCost } from '../lib/costCalculations'

export function useProductShipments() {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchShipments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('product_shipments')
      .select('*')
      .order('received_at', { ascending: false })

    if (!error) setShipments(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchShipments() }, [])

  const avgCostPerUnit = calcWeightedAvgCost(shipments)

  const addShipment = async ({ quantity, totalCostCents, supplierName, notes }) => {
    const { error } = await supabase
      .from('product_shipments')
      .insert([{ quantity, total_cost_cents: totalCostCents, supplier_name: supplierName || null, notes: notes || null }])
    if (!error) await fetchShipments()
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

  return { shipments, loading, avgCostPerUnit, addShipment, deleteShipment, refetch: fetchShipments }
}
