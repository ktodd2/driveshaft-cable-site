import { serverPurchase } from './purchaseAnalytics.js'
export const MEASUREMENT_ID = 'G-SDQTZK079P'
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)

export function analyticsMetadata(context, enabled) {
  if (!enabled || context?.allowed !== true || typeof context.client_id !== 'string' ||
      !/^\d{1,20}\.\d{1,20}$/.test(context.client_id)) return {}
  return { ga4_reporting: 'server_v1', ga4_client_id: context.client_id,
    ...(Number.isSafeInteger(context.session_id) && context.session_id > 0 ? { ga4_session_id: String(context.session_id) } : {}) }
}

export function queueEntry(event) {
  const intent = event.data?.object
  if (event.type !== 'payment_intent.succeeded' || event.livemode !== true ||
      !uuid(intent?.metadata?.order_id) || !serverPurchase(intent, intent.metadata.order_id) ||
      !analyticsMetadata({ allowed: true, client_id: intent.metadata.ga4_client_id }, true).ga4_reporting ||
      !Number.isSafeInteger(event.created) || event.created <= 0) return null
  return { order_id: intent.metadata.order_id, intent_id: intent.id,
    paid_at: new Date(event.created * 1000).toISOString() }
}

// Only new, explicitly server-owned payments enter this queue. Duplicate Stripe
// deliveries cannot reset a sent/uncertain row or replace its original timestamp.
export async function enqueuePurchase(db, event) {
  const entry = queueEntry(event)
  if (!entry) return
  const { error } = await db.from('ga4_purchase_outbox').upsert(entry, { onConflict: 'order_id', ignoreDuplicates: true })
  if (error) throw new Error('analytics_enqueue_failed')
}

export function measurementPayload(intent, row, now = Date.now()) {
  const paidAt = Date.parse(row.paid_at)
  if (!Number.isFinite(paidAt) || paidAt > now || now - paidAt > 71 * 3600000) return { skip: 'expired' }
  if (intent?.id !== row.intent_id || !uuid(row.order_id)) return { skip: 'invalid' }
  // Fail closed unless Stripe's expanded charge confirms no refund/dispute.
  const charge = intent.latest_charge
  if (!charge || typeof charge !== 'object' || !charge.paid || charge.amount_refunded !== 0 || charge.disputed) return { skip: 'refunded_or_unverified' }
  const purchase = serverPurchase(intent, row.order_id)
  const metadata = analyticsMetadata({ allowed: true, client_id: intent.metadata?.ga4_client_id }, true)
  if (!purchase || !metadata.ga4_client_id) return { skip: 'ineligible' }
  const sessionId = Number(intent.metadata.ga4_session_id)
  // Only attach a genuine, recent session. Never synthesize engagement duration.
  const session = Number.isSafeInteger(sessionId) && sessionId > 0 && sessionId * 1000 <= paidAt && now - sessionId * 1000 < 24 * 3600000
    ? { session_id: sessionId } : {}
  return { payload: { client_id: metadata.ga4_client_id, timestamp_micros: paidAt * 1000,
    consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    events: [{ name: 'purchase', params: { ...purchase, ...session } }] } }
}

// Transport failures are ambiguous: never blindly resend a possibly accepted
// purchase. Google also explicitly says not to retry the same non-2xx request.
export async function transmitPurchase(payload, secret, fetcher = fetch) {
  try {
    const response = await fetcher(`https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${encodeURIComponent(secret)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    return response.ok ? 'submitted' : 'rejected'
  } catch { return 'uncertain' }
}
