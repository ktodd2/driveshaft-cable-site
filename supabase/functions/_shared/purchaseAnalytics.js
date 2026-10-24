// Pure helpers shared by Edge Functions and offline tests. Never copy an order,
// customer, item name, discount code or Stripe object into an analytics payload.
const cents = value => Number.isSafeInteger(value) && value >= 0
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)

export function createPurchaseSnapshot(lines, subtotal, discount, shipping, tax) {
  const snapshot = {
    v: 1, s: subtotal, d: discount, h: shipping, t: tax,
    i: lines.map(line => [String(line.productId), line.quantity, line.unitPrice]),
  }
  const encoded = JSON.stringify(snapshot)
  // Stripe metadata values are limited to 500 characters. Analytics must never
  // prevent payment; an oversized basket can still pay, but won't be reported.
  return encoded.length <= 500 ? encoded : null
}

function readSnapshot(intent) {
  try {
    const snapshot = JSON.parse(intent.metadata?.ga4_purchase || 'null')
    if (!snapshot || snapshot.v !== 1) return null
    const { s, d, h, t, i } = snapshot
    if (![s, d, h, t].every(cents) || d > s || !Array.isArray(i) || !i.length || i.length > 100) return null
    if (!i.every(line => Array.isArray(line) && line.length === 3 && validId(line[0]) &&
      Number.isSafeInteger(line[1]) && line[1] > 0 && cents(line[2]))) return null
    const subtotal = i.reduce((sum, [, quantity, price]) => sum + quantity * price, 0)
    if (!Number.isSafeInteger(subtotal) || subtotal !== s || s - d + h + t !== intent.amount ||
      intent.amount_received !== intent.amount || intent.currency !== 'usd') return null
    return snapshot
  } catch { return null }
}

// Allocate order-level discounts in integer cents. A line may split into two
// GA items priced one cent apart, so sum(price * quantity) equals value exactly.
function discountedItems(snapshot) {
  let remainingDiscount = snapshot.d
  let remainingSubtotal = snapshot.s
  return snapshot.i.flatMap(([id, quantity, unitPrice]) => {
    const lineTotal = quantity * unitPrice
    const discount = remainingSubtotal ? Math.round(remainingDiscount * lineTotal / remainingSubtotal) : 0
    remainingDiscount -= discount
    remainingSubtotal -= lineTotal
    const net = lineTotal - discount
    const lowerPrice = Math.floor(net / quantity)
    const higherQuantity = net % quantity
    return [[lowerPrice, quantity - higherQuantity], [lowerPrice + 1, higherQuantity]]
      .filter(([, count]) => count > 0)
      .map(([price, count]) => ({
        item_id: id, price: price / 100, quantity: count,
        ...(price < unitPrice ? { discount: (unitPrice - price) / 100 } : {}),
      }))
  })
}

export function verifiedPurchaseResponse(intent, orderId, clientSecret) {
  // Both the capability returned at checkout and the server-owned order binding
  // must match. URL flags and client-written order payment_status are not proof.
  if (!intent || intent.client_secret !== clientSecret || intent.metadata?.order_id !== orderId) return null
  if (intent.status !== 'succeeded') {
    return { status: ['canceled', 'requires_payment_method'].includes(intent.status) ? 'failed' : 'pending' }
  }
  const snapshot = readSnapshot(intent)
  if (!snapshot) return { status: 'paid', purchase: null, order: null }
  const order = {
    subtotal_cents: snapshot.s, discount_cents: snapshot.d,
    shipping_cents: snapshot.h, tax_cents: snapshot.t, total_cents: intent.amount,
  }
  // Test payments and old intents without the new snapshot never generate GA
  // purchases. This is not a historical backfill or an offline sales importer.
  const purchase = intent.livemode === true ? {
    transaction_id: orderId,
    currency: 'USD',
    value: (snapshot.s - snapshot.d) / 100,
    shipping: snapshot.h / 100,
    tax: snapshot.t / 100,
    items: discountedItems(snapshot),
  } : null
  return { status: 'paid', order, purchase }
}
