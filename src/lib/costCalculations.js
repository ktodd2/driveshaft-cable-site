/** Read-only reporting estimates in cents. No historical costs are persisted. */
// Owner-selected reporting fallback; never written to an order.
export const DEFAULT_SHIPPING_ESTIMATE_CENTS = 1500
export const validCents = n => Number.isSafeInteger(n) && n >= 0
export function calcWeightedAvgCost(shipments = []) {
  const valid = shipments.filter(s => validCents(s.total_cost_cents) && Number.isInteger(s.quantity) && s.quantity > 0)
  const qty = valid.reduce((s, r) => s + r.quantity, 0)
  return qty ? Math.round(valid.reduce((s, r) => s + r.total_cost_cents, 0) / qty) : 0
}
export function calcWeightedAvgCostByProduct(shipments = []) {
  const groups = {}
  const invalid = new Set()
  for (const s of shipments) {
    const pid = s.product_id ?? '1'
    if (!validCents(s.total_cost_cents) || !Number.isInteger(s.quantity) || s.quantity <= 0) { invalid.add(String(pid)); continue }
    ;(groups[pid] ||= []).push(s)
  }
  return Object.fromEntries(Object.entries(groups).filter(([id]) => !invalid.has(id)).map(([id, rows]) => [id, calcWeightedAvgCost(rows)]))
}
export function calcOrderProfit(order, costMap = {}, fallback = DEFAULT_SHIPPING_ESTIMATE_CENTS) {
  if (order._report) return order._report
  const items = Array.isArray(order.items) ? order.items : []
  const units = items.reduce((s, i) => s + (Number.isInteger(i.quantity) && i.quantity > 0 ? i.quantity : 0), 0)
  const productKnown = items.length > 0 && items.every(i => Number.isInteger(i.quantity) && i.quantity > 0 && validCents(costMap[i.productId]))
  const productCost = productKnown ? items.reduce((s, i) => s + i.quantity * costMap[i.productId], 0) : null
  const shippingKnown = validCents(order.actual_shipping_cost_cents)
  const shippingEstimated = order.actual_shipping_cost_cents == null && validCents(fallback) && fallback > 0
  const shippingCost = shippingKnown ? order.actual_shipping_cost_cents : shippingEstimated ? fallback : null
  const revenue = validCents(order.total_cents) && validCents(order.tax_cents) && order.tax_cents <= order.total_cents ? order.total_cents - order.tax_cents : null
  const stripeFee = validCents(order.total_cents) ? (order.payment_method == null || order.payment_method === 'stripe' ? Math.round(order.total_cents * .029) + 30 : ['cash', 'zelle', 'cashapp'].includes(order.payment_method) ? 0 : null) : null
  const profit = [revenue, productCost, shippingCost, stripeFee].every(n => n !== null) ? revenue - productCost - shippingCost - stripeFee : null
  const uncertaintyFlags = [!shippingKnown && 'shipping_not_recorded', !productKnown && 'product_cost_unknown', revenue === null && 'total_or_tax_invalid', stripeFee === null && 'fee_unknown'].filter(Boolean)
  return { units, revenue, productCost, shippingCost, stripeFee, profit, shippingKnown, shippingEstimated, productKnown, uncertaintyFlags }
}
const sumKnown = (rows, key) => rows.reduce((sum, r) => sum + (r[key] ?? 0), 0)
export function calcProfitStats(orders, costs, fallback = DEFAULT_SHIPPING_ESTIMATE_CENTS) {
  const rows = orders.map(o => calcOrderProfit(o, costs, fallback))
  const totalRevenue = rows.every(r => r.revenue !== null) ? sumKnown(rows, 'revenue') : null
  const netProfit = rows.every(r => r.profit !== null) ? sumKnown(rows, 'profit') : null
  return { totalRevenue, totalProductCost: rows.every(r => r.productCost !== null) ? sumKnown(rows, 'productCost') : null, totalShippingCost: rows.every(r => r.shippingCost !== null) ? sumKnown(rows, 'shippingCost') : null, totalStripeFees: rows.every(r => r.stripeFee !== null) ? sumKnown(rows, 'stripeFee') : null, netProfit,
    margin: netProfit === null || totalRevenue === null ? null : totalRevenue > 0 ? netProfit / totalRevenue * 100 : 0,
    ordersWithoutShipping: rows.filter(r => !r.shippingKnown).length,
    ordersWithShippingEstimates: rows.filter(r => r.shippingEstimated).length,
    totalShippingEstimateCents: rows.filter(r => r.shippingEstimated).reduce((sum, r) => sum + r.shippingCost, 0), ordersWithoutProductCost: rows.filter(r => !r.productKnown).length,
    incompleteOrders: rows.filter(r => r.profit === null).length, ordersWithOtherUnknowns: rows.filter(r => r.revenue === null || r.stripeFee === null).length, totalUnits: sumKnown(rows, 'units') }
}
// Largest-remainder allocation preserves cents, including fixed fees.
function allocate(value, weights) {
  if (value === null) return weights.map(() => null)
  const total = weights.reduce((a,b) => a+b, 0)
  const raw = weights.map(w => value * w / total)
  const result = raw.map(Math.floor)
  const priority = raw.map((n,i) => ({i, remainder:n-result[i]})).sort((a,b) => b.remainder-a.remainder || a.i-b.i)
  const remainder = value-result.reduce((a,b)=>a+b,0)
  for(let i=0; i<remainder; i++) result[priority[i].i]++
  return result
}
export function scopeOrdersToProduct(order, costs, fallback = DEFAULT_SHIPPING_ESTIMATE_CENTS) {
  const items = Array.isArray(order.items) ? order.items : []
  if (!items.length || items.some(i => !Number.isInteger(i.quantity) || i.quantity <= 0 || i.productId == null)) return []
  const ids = [...new Set(items.map(i => String(i.productId)))].sort()
  const groups = ids.map(id => items.filter(i => String(i.productId) === id))
  let weights = groups.map(group => group.reduce((s,i)=>s+(validCents(i.price)?i.price:0)*i.quantity,0))
  if (!weights.some(Boolean)) weights = groups.map(group=>group.reduce((s,i)=>s+i.quantity,0))
  const report = calcOrderProfit(order,costs,fallback)
  const fields = Object.fromEntries(['revenue','shippingCost','stripeFee'].map(k=>[k,allocate(report[k],weights)]))
  const totals = allocate(validCents(order.total_cents)?order.total_cents:null,weights)
  return ids.map((id,index)=>{
    const r = calcOrderProfit({...order,items:groups[index]},costs,fallback)
    for(const k of Object.keys(fields)) r[k]=fields[k][index]
    r.profit = [r.revenue,r.productCost,r.shippingCost,r.stripeFee].every(n=>n!==null) ? r.revenue-r.productCost-r.shippingCost-r.stripeFee : null
    return {...order,items:groups[index],total_cents:totals[index],_scopedToProduct:id,_report:r}
  })
}
export function calcPerProductStats(orders,costs,fallback=DEFAULT_SHIPPING_ESTIMATE_CENTS) {
  const groups={}
  for(const order of orders) for(const row of scopeOrdersToProduct(order,costs,fallback)) (groups[row._scopedToProduct] ||= []).push(row)
  return Object.fromEntries(Object.entries(groups).map(([id,rows])=>{const s=calcProfitStats(rows,costs,fallback);return [id,{revenue:s.totalRevenue,units:s.totalUnits,profit:s.netProfit,margin:s.margin}]}))
}
