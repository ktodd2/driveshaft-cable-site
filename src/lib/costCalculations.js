/**
 * Shared profit calculation functions for admin pages.
 * All money values are in integer cents.
 */

/**
 * Global weighted average cost per unit across all shipments.
 * Kept as a back-compat helper for callers that don't (yet) know about
 * per-product cost. New code should prefer calcWeightedAvgCostByProduct.
 * @param {Array} shipments - Array of { quantity, total_cost_cents }
 * @returns {number} Average cost per unit in cents, or 0 if no shipments
 */
export function calcWeightedAvgCost(shipments) {
  if (!shipments || shipments.length === 0) return 0
  const totalQty = shipments.reduce((sum, s) => sum + s.quantity, 0)
  const totalCost = shipments.reduce((sum, s) => sum + s.total_cost_cents, 0)
  if (totalQty === 0) return 0
  return Math.round(totalCost / totalQty)
}

/**
 * Per-product weighted average cost per unit.
 * @param {Array} shipments - Array of { product_id, quantity, total_cost_cents }
 * @returns {Object} { [product_id]: avgCostInCents }
 */
export function calcWeightedAvgCostByProduct(shipments) {
  const totals = {}
  if (!shipments) return totals
  for (const s of shipments) {
    const pid = s.product_id ?? '1'
    if (!totals[pid]) totals[pid] = { qty: 0, cost: 0 }
    totals[pid].qty += s.quantity
    totals[pid].cost += s.total_cost_cents
  }
  const result = {}
  for (const pid of Object.keys(totals)) {
    result[pid] = totals[pid].qty > 0 ? Math.round(totals[pid].cost / totals[pid].qty) : 0
  }
  return result
}

// Internal helper: resolve productCost from either a flat number (legacy) or
// a per-product cost map. With a map we sum each line's quantity × map-cost.
function computeProductCost(items, costMapOrCost) {
  if (typeof costMapOrCost === 'number') {
    const totalUnits = items.reduce((s, i) => s + (i.quantity || 0), 0)
    return totalUnits * costMapOrCost
  }
  const map = costMapOrCost || {}
  return items.reduce((sum, item) => {
    const pid = item.productId
    const unitCost = map[pid] ?? 0
    return sum + (item.quantity || 0) * unitCost
  }, 0)
}

/**
 * Calculate profit for a single order.
 * Uses actual_shipping_cost_cents if available, otherwise falls back.
 * @param {Object} order - Order row
 * @param {number|Object} costMapOrCost - Either a flat per-unit cost (legacy)
 *   or a per-product cost map like { '1': 200, '2': 220 }
 * @param {number} fallbackShippingCents
 */
export function calcOrderProfit(order, costMapOrCost, fallbackShippingCents = 0) {
  const items = order.items || []
  const units = items.reduce((s, i) => s + (i.quantity || 0), 0)
  const productCost = computeProductCost(items, costMapOrCost)
  const shippingKnown = order.actual_shipping_cost_cents != null
  const shippingCost = shippingKnown ? order.actual_shipping_cost_cents : fallbackShippingCents
  // Cash, Zelle, and CashApp incur no processing fee. Null is treated as
  // 'stripe' so legacy rows from before the payment_method column existed
  // continue to amortize fees the way they always did.
  const incursStripeFee = order.payment_method == null || order.payment_method === 'stripe'
  const stripeFee = incursStripeFee ? Math.round(order.total_cents * 0.029) + 30 : 0
  const profit = order.total_cents - productCost - shippingCost - stripeFee
  return { units, productCost, shippingCost, stripeFee, profit, shippingKnown }
}

/**
 * Calculate aggregate profit stats for a list of orders.
 */
export function calcProfitStats(ordersList, costMapOrCost, fallbackShippingCents = 0) {
  let totalRevenue = 0
  let totalProductCost = 0
  let totalShippingCost = 0
  let totalStripeFees = 0
  let ordersWithoutShipping = 0

  ordersList.forEach(order => {
    const result = calcOrderProfit(order, costMapOrCost, fallbackShippingCents)
    totalRevenue += order.total_cents
    totalProductCost += result.productCost
    totalShippingCost += result.shippingCost
    totalStripeFees += result.stripeFee
    if (!result.shippingKnown) ordersWithoutShipping++
  })

  const netProfit = totalRevenue - totalProductCost - totalShippingCost - totalStripeFees
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  return { totalRevenue, totalProductCost, totalShippingCost, totalStripeFees, netProfit, margin, ordersWithoutShipping }
}

/**
 * Per-product breakdown of revenue, units, profit, and margin for a list of
 * orders. Splits each order's revenue proportionally across its line items by
 * (qty × line_price), so a mixed cart contributes correctly to each product.
 * Shipping cost and Stripe fees are also split proportionally by line revenue
 * since they're per-order, not per-product.
 *
 * @param {Array} orders - Order rows
 * @param {Object} costMap - { [productId]: costPerUnitInCents }
 * @param {number} fallbackShippingCents
 * @returns {Object} { [productId]: { revenue, units, productCost, profit, margin } }
 */
export function calcPerProductStats(orders, costMap, fallbackShippingCents = 0) {
  const stats = {}
  const ensure = (pid) => {
    if (!stats[pid]) {
      stats[pid] = { revenue: 0, units: 0, productCost: 0, shippingCost: 0, stripeFees: 0 }
    }
    return stats[pid]
  }

  for (const order of orders) {
    const items = order.items || []
    if (items.length === 0) continue

    // Line revenue from the items array. Each item.price is the per-unit
    // price the customer actually paid for that line.
    const lineRevenues = items.map(i => (i.price || 0) * (i.quantity || 0))
    const grossLineRevenue = lineRevenues.reduce((a, b) => a + b, 0)
    if (grossLineRevenue === 0) continue

    // Split the order's tax + discount + shipping + Stripe fees across lines
    // proportional to line revenue, so each product's revenue is its actual
    // net contribution to the order total.
    const shippingKnown = order.actual_shipping_cost_cents != null
    const orderShipping = shippingKnown ? order.actual_shipping_cost_cents : fallbackShippingCents
    const incursStripeFee = order.payment_method == null || order.payment_method === 'stripe'
    const orderStripeFee = incursStripeFee ? Math.round(order.total_cents * 0.029) + 30 : 0

    // Each line's share of order_total (which already includes tax + discount
    // + shipping mixed in). We approximate using line-price proportion, which
    // is accurate when discount/tax are applied uniformly.
    items.forEach((item, idx) => {
      const pid = item.productId
      const share = lineRevenues[idx] / grossLineRevenue
      const lineRevenueOfOrderTotal = Math.round(order.total_cents * share)
      const s = ensure(pid)
      s.revenue += lineRevenueOfOrderTotal
      s.units += item.quantity || 0
      s.productCost += (item.quantity || 0) * (costMap?.[pid] ?? 0)
      s.shippingCost += Math.round(orderShipping * share)
      s.stripeFees += Math.round(orderStripeFee * share)
    })
  }

  // Derive profit + margin for each product.
  for (const pid of Object.keys(stats)) {
    const s = stats[pid]
    s.profit = s.revenue - s.productCost - s.shippingCost - s.stripeFees
    s.margin = s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0
  }

  return stats
}
