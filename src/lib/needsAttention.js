// Read-only attention queues. Never treat a missing cost as a recorded zero.
export function isRecordedPaidOrder(order) {
  return order.payment_status === 'paid' &&
    ['confirmed', 'shipped', 'delivered'].includes(order.status) &&
    order.is_test !== true && order.test_mode !== true && order.livemode !== false &&
    !order.refunded_at && !(order.refunded_amount_cents > 0)
}

export function orderQueues(orders) {
  const eligible = orders.filter(isRecordedPaidOrder)
  return {
    fulfillment: eligible.filter(o => o.status === 'confirmed' && !o.tracking_number?.trim()),
    tracking: eligible.filter(o => o.status === 'shipped' && !o.tracking_number?.trim()),
    status: eligible.filter(o => o.status === 'confirmed' && o.tracking_number?.trim()),
    shipping: eligible.filter(o => o.actual_shipping_cost_cents == null),
  }
}

// Paginate instead of silently accepting Supabase's default row limit. Fail
// closed if a page fails: partial data must never look like a complete queue.
export async function readAttentionRows(client, table, select = '*', configure = q => q) {
  const rows = []
  const pageSize = 500
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await configure(client.from(table).select(select))
      .order('id', { ascending: true }).range(start, start + pageSize - 1)
    if (error || !Array.isArray(data)) throw new Error(`Unable to load ${table}`)
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

export const oldestFirst = rows => [...rows].sort((a, b) =>
  (Date.parse(a.created_at || a.sent_at) || 0) - (Date.parse(b.created_at || b.sent_at) || 0))

// Matching email is evidence to review, never proof a quote converted.
export function possibleQuotePurchases(quote, orders) {
  const email = String(quote.email || '').trim().toLowerCase()
  const created = Date.parse(quote.created_at)
  if (!email || !Number.isFinite(created)) return []
  return orders.filter(order => isRecordedPaidOrder(order) &&
    String(order.email || '').trim().toLowerCase() === email &&
    Date.parse(order.created_at) >= created)
}
