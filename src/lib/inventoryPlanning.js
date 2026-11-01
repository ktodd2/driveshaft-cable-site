import { isRecordedPaidOrder } from './needsAttention.js'
const DAY = 86400000
export const PLANNING_LIMITATIONS = 'Planning estimate from recorded paid, confirmed/shipped/delivered orders by order creation date. Cancelled, refunded and known test orders are excluded. Historical test/refund flags are incomplete. Sales measure fulfilled demand, not lost demand: stockouts can understate the rate. Receipt totals are never added to current stock. Incoming plans do not change sellable stock or product costs.'
export function dateTime(date) {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? Date.parse(date+'T00:00:00Z') : NaN
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === date ? time : NaN
}
export function forecast({ orders, stock, productId, days = 30, leadDays = null, safetyDays = null, now = new Date() }) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const start = end - days * DAY // Completed UTC days; never divide a partial day by a whole day.
  let units = 0, count = 0, invalid = 0
  const seen = new Set()
  for (const o of orders) {
    if (seen.has(o.id)) continue
    seen.add(o.id)
    if (!isRecordedPaidOrder(o) || Date.parse(o.created_at) < start || Date.parse(o.created_at) >= end || !Number.isFinite(Date.parse(o.created_at))) continue
    if (!Array.isArray(o.items) || !o.items.length) { invalid++; continue }
    let included = false
    for (const item of o.items) {
      if (item.productId == null || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) { invalid++; continue }
      if (String(item.productId) === String(productId)) { units += item.quantity; included = true }
    }
    if (included) count++
  }
  const known = Number.isSafeInteger(stock)
  const rate = units / days
  const runway = known && rate > 0 ? Math.max(stock, 0) / rate : null
  const configured = [leadDays, safetyDays].every(v => Number.isInteger(v) && v >= 0 && v <= 730)
  const reorderPoint = configured ? Math.ceil(rate * (leadDays + safetyDays)) : null
  const status = !known ? 'Unknown stock' : stock <= 0 ? 'Out of stock — demand may be understated' : invalid ? 'Review incomplete sales data' : !units ? 'No observed sales — runway unknown' : configured && stock <= reorderPoint ? 'Reorder review needed' : configured ? 'Above reorder threshold' : 'Set lead time and safety cushion'
  return { units, count, invalid, rate, runway, reorderPoint, status, start: new Date(start).toISOString().slice(0,10), end: new Date(end).toISOString().slice(0,10), lowVolume: count < 5 }
}
// A receipt may satisfy only one incoming line. Ambiguous records are withheld.
export function reconcileIncoming(lines, receipts, now = new Date()) {
  const keys = new Map(), links = new Map()
  for (const line of lines) {
    const key = `${String(line.reference).trim().toLowerCase()}|${line.productId}`
    keys.set(key, (keys.get(key) || 0) + 1)
    for (const id of line.receiptIds || []) links.set(id, (links.get(id) || 0) + 1)
  }
  return lines.map(line => {
    const key = `${String(line.reference).trim().toLowerCase()}|${line.productId}`
    let issue = !line.reference?.trim() || !line.productId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ? 'Invalid plan' : keys.get(key) > 1 ? 'Duplicate reference/product — resolve before planning' : null
    let received = 0
    for (const id of line.receiptIds || []) {
      const matches = receipts.filter(r => String(r.id) === String(id))
      const r = matches[0]
      if (links.get(id) > 1 || matches.length !== 1 || String(r.product_id) !== String(line.productId) || !Number.isSafeInteger(r.quantity) || r.quantity <= 0) issue = 'Receipt link is missing, duplicated or mismatched'
      else received += r.quantity
    }
    if (received > line.quantity) issue = 'Linked receipts exceed ordered quantity'
    const from = dateTime(line.etaStart), to = dateTime(line.etaEnd)
    if ((line.etaStart || line.etaEnd) && (!Number.isFinite(from) || !Number.isFinite(to) || from > to)) issue = 'Invalid estimated date range'
    const remaining = issue ? null : Math.max(0, line.quantity - received)
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const status = issue || (remaining === 0 ? 'Fully linked to receipts' : !Number.isFinite(to) ? 'ETA unknown' : to < today ? 'Overdue — reconfirm ETA' : 'Estimated arrival')
    return { ...line, received, remaining, status, issue, daysToLatest: Number.isFinite(to) ? (to - today) / DAY : null }
  })
}
export function incomingWarning(forecast, line) {
  if (line.issue || !line.remaining) return null
  if (line.daysToLatest == null || line.daysToLatest < 0) return 'Arrival timing unresolved; do not rely on this plan for coverage.'
  if (forecast.runway != null && forecast.runway <= line.daysToLatest) return 'Risk: current stock may run out before the latest estimated arrival.'
  return 'Proposed units are excluded from runway and reorder thresholds.'
}
