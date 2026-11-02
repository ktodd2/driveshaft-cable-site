import { analyticsAllowed, GA_MEASUREMENT_ID } from './purchaseAnalytics.js'

const events = new Set(['view_item', 'add_to_cart', 'begin_checkout'])

// Only product IDs, quantities and integer-cent prices enter the funnel.
// Customer fields, discount codes and URL queries are never copied into events.
export function commercePayload(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 200) return null
  let cents = 0
  const items = []
  for (const line of lines) {
    const id = String(line.productId ?? '')
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 ||
        !Number.isSafeInteger(line.unitCents) || line.unitCents < 0) return null
    cents += line.quantity * line.unitCents
    if (!Number.isSafeInteger(cents)) return null
    items.push({ item_id: id, quantity: line.quantity, price: line.unitCents / 100 })
  }
  return { currency: 'USD', value: cents / 100, items }
}

export function reportCommerceEvent(name, lines, browser = globalThis.window) {
  try {
    if (!events.has(name)) return 'invalid'
    const payload = commercePayload(lines)
    if (!payload) return 'invalid'
    if (!browser || !analyticsAllowed(browser)) return 'denied'
    if (typeof browser.gtag !== 'function') return 'unavailable'
    // Use a clean, fixed path rather than query strings or recovery-link data.
    const page = name === 'begin_checkout' ? '/checkout' : name === 'add_to_cart' ? '/cart' : '/products'
    browser.gtag('event', name, { ...payload, send_to: GA_MEASUREMENT_ID,
      page_location: `${browser.location.origin}${page}` })
    return 'queued'
  } catch { return 'error' } // Tracking must never prevent shopping.
}

// One view per mounted visit, even when inventory/pricing resolves or React
// replays an effect. A different product key represents a new detail view.
export function createCommerceVisit() {
  let previous = null
  return (name, key, lines, browser = globalThis.window) => {
    const identity = `${name}:${key}`
    if (previous === identity) return 'duplicate'
    const result = reportCommerceEvent(name, lines, browser)
    if (result === 'queued') previous = identity
    return result
  }
}
