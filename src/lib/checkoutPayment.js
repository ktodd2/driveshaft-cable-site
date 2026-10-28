const STORAGE_KEY = 'ktodd-checkout-payment'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

const cartSignature = items => JSON.stringify(items.map(item => [String(item.productId), item.quantity]).sort((a, b) => a[0].localeCompare(b[0])))

export function rememberCheckoutPayment(orderId, clientSecret, browser = window, items = []) {
  const payment = { orderId, clientSecret, savedAt: Date.now(), cartSignature: cartSignature(items) }
  browser.__checkoutPayment = payment
  try { browser.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payment)) } catch { /* In-memory fallback. */ }
}

export function getCheckoutPayment(orderId, browser = window) {
  let payment = browser.__checkoutPayment
  if (payment?.orderId !== orderId) {
    try { payment = JSON.parse(browser.sessionStorage.getItem(STORAGE_KEY)) } catch { return null }
  }
  if (payment?.orderId !== orderId || typeof payment.clientSecret !== 'string' ||
    !Number.isFinite(payment.savedAt) || Date.now() - payment.savedAt > MAX_AGE_MS) return null
  return payment
}

// An old confirmation page must not empty a newly filled cart on Back/reload.
export function clearPurchasedCart(orderId, items, clearCart, browser = window) {
  const payment = getCheckoutPayment(orderId, browser)
  if (!payment || payment.cartCleared) return
  if (payment.cartSignature === cartSignature(items)) clearCart()
  payment.cartCleared = true
  browser.__checkoutPayment = payment
  try { browser.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payment)) } catch { /* Memory is enough for this visit. */ }
}

export async function verifyCheckoutPayment(orderId, clientSecret, signal) {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-purchase`, {
    method: 'POST', signal,
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ orderId, clientSecret }),
  })
  if (!response.ok) throw new Error('Unable to confirm payment right now')
  return response.json()
}
