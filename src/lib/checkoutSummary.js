// Attach only verified server unit prices to the current cart's display details.
// Reject stale, partial or inconsistent line sets instead of mixing a quoted
// subtotal with prices from a different catalog snapshot.
export function quotedCheckoutItems(items, quote) {
  if (!Array.isArray(quote.linePrices) || quote.linePrices.length !== items.length) {
    throw Error('Could not verify the quoted item prices.')
  }
  const prices = new Map()
  for (const line of quote.linePrices) {
    if (!line || prices.has(line.productId) || !Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) {
      throw Error('Could not verify the quoted item prices.')
    }
    prices.set(line.productId, line)
  }
  const pricedItems = items.map(item => {
    const line = prices.get(item.productId)
    if (!line || line.quantity !== item.quantity || !Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw Error('Could not verify the quoted item prices.')
    }
    return { ...item, price: line.unitPrice }
  })
  const subtotal = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (!Number.isSafeInteger(subtotal) || subtotal !== quote.subtotalCents) {
    throw Error('Could not verify the quoted item prices.')
  }
  return pricedItems
}
