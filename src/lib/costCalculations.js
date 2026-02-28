/**
 * Shared profit calculation functions for admin pages.
 * All money values are in integer cents.
 */

/**
 * Calculate weighted average cost per unit from shipment records.
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
 * Calculate profit for a single order.
 * Uses actual_shipping_cost_cents if available, otherwise falls back.
 */
export function calcOrderProfit(order, avgCostPerUnit, fallbackShippingCents = 0) {
  const units = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0)
  const productCost = units * avgCostPerUnit
  const shippingKnown = order.actual_shipping_cost_cents != null
  const shippingCost = shippingKnown ? order.actual_shipping_cost_cents : fallbackShippingCents
  const stripeFee = Math.round(order.total_cents * 0.029) + 30
  const profit = order.total_cents - productCost - shippingCost - stripeFee
  return { units, productCost, shippingCost, stripeFee, profit, shippingKnown }
}

/**
 * Calculate aggregate profit stats for a list of orders.
 */
export function calcProfitStats(ordersList, avgCostPerUnit, fallbackShippingCents = 0) {
  let totalRevenue = 0
  let totalProductCost = 0
  let totalShippingCost = 0
  let totalStripeFees = 0
  let ordersWithoutShipping = 0

  ordersList.forEach(order => {
    const result = calcOrderProfit(order, avgCostPerUnit, fallbackShippingCents)
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
