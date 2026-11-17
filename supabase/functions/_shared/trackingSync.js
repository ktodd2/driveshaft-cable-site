// Fail closed: only explicit delivery status for the requested package qualifies.
export const normalizeTracking = value => String(value || '').replace(/\s/g, '').toUpperCase()
const text = value => String(value || '').trim().toLowerCase()
const failure = reason => ({ status: 'lookup_failed', error: reason })
export function statusText(value) {
  const s = text(value)
  if (s === 'delivered' || /^delivered, (in\/at mailbox|front door\/porch|left with individual|parcel locker|individual picked up at postal facility)$/.test(s)) return 'delivered'
  if (s.includes('out for delivery')) return 'out_for_delivery'
  if (/attempt|undeliver|not delivered|return|exception|alert|delay/.test(s)) return 'exception'
  if (/in transit|on the way|arrived|departed/.test(s)) return 'in_transit'
  if (/pre-shipment|label|accepted|order processed/.test(s)) return 'pre_transit'
  return 'unknown'
}
function verifiedDelivery(result, date, order, now) {
  if (result.status !== 'delivered') return result
  // Require a real event date, not an estimated delivery date. This also
  // rejects a recycled tracking number whose event predates this order.
  const compact = /^\d{8}$/.test(String(date)) ? `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}` : date
  const ms = Date.parse(compact)
  const created = Date.parse(order.created_at)
  if (!Number.isFinite(ms) || !Number.isFinite(created) || ms < created - 86400000 || ms > now + 86400000) return failure('delivery_date_unverified')
  // Preserve timestamps only when the carrier supplies a timezone; never
  // pretend that the poll time was the delivery time.
  return { ...result, deliveredAt: /T.*(?:Z|[+-]\d\d:\d\d)$/.test(String(compact)) ? new Date(ms).toISOString() : null }
}
export function parseUsps(payload, order, now = Date.now()) {
  if (normalizeTracking(payload?.trackingNumber) !== normalizeTracking(order.tracking_number)) return failure('tracking_identity_mismatch')
  const status = statusText(payload.statusCategory)
  const event = payload.trackingEvents?.[0]
  const result = { status: status === 'unknown' && !payload.statusCategory ? statusText(event?.eventType) : status, raw: String(payload.statusCategory || event?.eventType || '').slice(0,120) }
  return verifiedDelivery(result, statusText(event?.eventType) === 'delivered' ? event?.eventTimestamp : null, order, now)
}
export function parseUps(payload, order, now = Date.now()) {
  const packages = (payload?.trackResponse?.shipment || []).flatMap(s => s.package || [])
  const matching = packages.filter(p => normalizeTracking(p.trackingNumber) === normalizeTracking(order.tracking_number))
  if (matching.length !== 1) return failure('tracking_identity_mismatch')
  const p = matching[0]
  // currentStatus type D is the carrier's delivered category. Never use an
  // arbitrary historical event or a substring such as "not delivered".
  let status = statusText(p.currentStatus?.description)
  if (!text(p.currentStatus?.description) && p.currentStatus?.type === 'D') status = 'delivered'
  const event = p.activity?.[0]
  const time = String(event?.gmtTime || '').padStart(6, '0')
  const gmtDate = String(event?.gmtDate || '')
  const validGmt = /^\d{8}$/.test(gmtDate) && /^\d{6}$/.test(time) && +time.slice(0,2) < 24 && +time.slice(2,4) < 60 && +time.slice(4,6) < 60
  const date = event?.status?.type === 'D' ? validGmt ? `${gmtDate.slice(0,4)}-${gmtDate.slice(4,6)}-${gmtDate.slice(6,8)}T${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}Z` : event.date : null
  return verifiedDelivery({ status, raw: String(p.currentStatus?.description || '').slice(0,120) }, date, order, now)
}
export async function applyTrackingResult(db, order, result, nowIso) {
  const patch = { tracking_status: result.status, tracking_last_checked_at: nowIso }
  if (result.status === 'delivered') Object.assign(patch, { status: 'delivered', delivered_at: order.delivered_at || result.deliveredAt || null, updated_at: nowIso })
  let query = db.from('orders').update(patch).eq('id', order.id).eq('status', 'shipped')
    .eq('payment_status', 'paid').eq('stock_decremented', true).eq('tracking_number', order.tracking_number)
  // Compare every mutable source field, so edits, refunds, and simultaneous
  // jobs cannot overwrite newer decisions or count the same delivery twice.
  for (const key of ['tracking_carrier', 'updated_at', 'tracking_last_checked_at', 'delivered_at']) query = order[key] === null ? query.is(key, null) : query.eq(key, order[key])
  return await query.select('id')
}
