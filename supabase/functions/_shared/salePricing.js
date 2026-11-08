// One rule shared by storefront and checkout: eligible sale percentages add
// after volume pricing, capped at 100%. Round once at the unit-cent boundary.
export function activeSalesForProduct(productId, sales = [], now = Date.now()) {
  const seen = new Set()
  return (sales || []).filter(sale => {
    if (!sale?.is_active || !Number.isFinite(sale.discount_percent) || sale.discount_percent <= 0) return false
    if (!(now >= Date.parse(sale.starts_at) && now < Date.parse(sale.ends_at))) return false
    if (sale.scope !== 'sitewide' && !(sale.scope === 'product' && sale.product_id === productId)) return false
    if (sale.id && seen.has(sale.id)) return false
    if (sale.id) seen.add(sale.id)
    return true
  })
}

export function combinedSalePercent(sales) {
  return Math.min(100, sales.reduce((sum, sale) => sum + Math.min(100, sale.discount_percent), 0))
}

export function saleUnitPrice(tierPrice, sales) {
  if (!Number.isSafeInteger(tierPrice) || tierPrice < 0) throw Error('Invalid product price')
  return Math.max(0, Math.round(tierPrice * (100 - combinedSalePercent(sales)) / 100))
}
