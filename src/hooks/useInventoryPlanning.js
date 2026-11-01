import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readSharedPlan, writeSharedPlan } from '../lib/inventoryPlanStorage'
import { readAttentionRows } from '../lib/needsAttention'
export function useInventoryPlanning() {
  const [state, setState] = useState({ loading: true })
  const refresh = useCallback(async () => {
    setState({ loading: true })
    try {
      const [products, inventory, orders, receipts] = await Promise.all([
        readAttentionRows(supabase, 'products', 'id,name'),
        // Inventory has product_id, not necessarily a separate id.
        supabase.from('product_inventory').select('product_id,stock_quantity').order('product_id').then(({ data, error }) => { if (error || !data || data.length >= 1000) throw Error('inventory'); return data }),
        readAttentionRows(supabase, 'orders', 'id,created_at,items,payment_status,status'),
        readAttentionRows(supabase, 'product_shipments', 'id,product_id,quantity,received_at'),
      ])
      setState({ products, inventory, orders, receipts, loading: false, loadedAt: new Date() })
    } catch { setState({ loading: false, error: 'Inventory planning data unavailable. Forecasts withheld; retry to load a complete snapshot.' }) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return { ...state, refresh, readShared: () => readSharedPlan(supabase), writeShared: request => writeSharedPlan(supabase, request) }
}
