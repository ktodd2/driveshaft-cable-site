export const GA_MEASUREMENT_ID = 'G-SDQTZK079P'
const queuedTransactions = new Set()
const keyFor = id => `ktodd-ga4-purchase:${id}`

// No consent is granted or changed here. Respect explicit gtag denial and the
// existing opt-out. With no CMP installed, keep the site's existing tag policy.
export function analyticsAllowed(browser) {
  if (browser[`ga-disable-${GA_MEASUREMENT_ID}`] === true || browser.navigator?.globalPrivacyControl === true) return false
  let analyticsStorage
  for (const command of browser.dataLayer || []) {
    if (command?.[0] === 'consent' && ['default', 'update'].includes(command[1]) &&
      command[2]?.analytics_storage) analyticsStorage = command[2].analytics_storage
  }
  return analyticsStorage !== 'denied'
}

function safePurchase(purchase) {
  if (!purchase || !/^[a-f0-9-]{36}$/i.test(purchase.transaction_id) || purchase.currency !== 'USD' ||
    ![purchase.value, purchase.shipping, purchase.tax].every(n => Number.isFinite(n) && n >= 0) ||
    !Array.isArray(purchase.items) || !purchase.items.length || purchase.items.length > 200) return null
  const items = []
  for (const item of purchase.items) {
    if (typeof item.item_id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.item_id) ||
      !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.price) || item.price < 0) return null
    items.push({ item_id: item.item_id, price: item.price, quantity: item.quantity,
      ...(Number.isFinite(item.discount) && item.discount >= 0 ? { discount: item.discount } : {}),
    })
  }
  if (Math.abs(items.reduce((sum, item) => sum + item.price * item.quantity, 0) - purchase.value) > 0.000001) return null
  // Explicit allowlist: never forward names, emails, addresses, client secrets,
  // arbitrary server fields, or the current URL's query string to GA.
  return {
    transaction_id: purchase.transaction_id, currency: 'USD', value: purchase.value,
    shipping: purchase.shipping, tax: purchase.tax, items,
  }
}

export async function reportPurchase(purchase, browser = window) {
  const payload = safePurchase(purchase)
  if (!payload) return 'invalid'
  const send = () => {
    if (!analyticsAllowed(browser)) return 'denied'
    if (typeof browser.gtag !== 'function') return 'unavailable'
    const id = payload.transaction_id
    if (queuedTransactions.has(id)) return 'duplicate'
    try { if (browser.localStorage.getItem(keyFor(id))) return 'duplicate' } catch { /* Storage may be disabled. */ }
    queuedTransactions.add(id)
    try {
      browser.gtag('event', 'purchase', {
        ...payload, send_to: GA_MEASUREMENT_ID,
        page_location: `${browser.location.origin}/checkout/success`,
      })
      try { browser.localStorage.setItem(keyFor(id), '1') } catch { /* GA also deduplicates transaction_id. */ }
      // Queued, not guaranteed delivered: ad blockers/offline tabs can prevent delivery.
      return 'queued'
    } catch {
      queuedTransactions.delete(id)
      return 'error'
    }
  }
  // Web Locks prevent simultaneous tabs racing the storage check where supported.
  try {
    return browser.navigator?.locks?.request
      ? await browser.navigator.locks.request(keyFor(payload.transaction_id), send)
      : send()
  } catch { return 'error' }
}
