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

// This campaign excludes the returning-customer discount, without changing
// other sale/coupon policies. Pausing it or reaching its end restores loyalty.
const BLACK_FRIDAY_2026_SALE_ID = 'f12adf43-0ec1-419f-b69b-796b82c2f426'
export function blocksReturningCustomerDiscount(sales = [], now = Date.now()) {
  return activeSalesForProduct(null, sales, now).some(sale =>
    sale.scope === 'sitewide' && sale.id === BLACK_FRIDAY_2026_SALE_ID
  )
}

export function combinedSalePercent(sales) {
  return Math.min(100, sales.reduce((sum, sale) => sum + Math.min(100, sale.discount_percent), 0))
}

export function saleUnitPrice(tierPrice, sales) {
  if (!Number.isSafeInteger(tierPrice) || tierPrice < 0) throw Error('Invalid product price')
  return Math.max(0, Math.round(tierPrice * (100 - combinedSalePercent(sales)) / 100))
}
