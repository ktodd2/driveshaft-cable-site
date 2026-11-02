import { isRecordedPaidOrder, readAttentionRows } from './needsAttention.js'
import { saveShippingGroup, shippingSourceKey } from './shippingImport.js'

const exact = value => String(value ?? '').trim().toLowerCase()
const tracking = value => String(value ?? '').trim().toUpperCase()
const isLedger = row => 'Type' in row.raw && 'Description' in row.raw
// The observed Transactions.xlsx uses this explicit US timestamp + zone format.
export function ledgerTimestamp(value) {
  const m = String(value ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}) (\d{1,2}):(\d{2}) (AM|PM) (CST|CDT)$/)
  if (!m) return NaN
  const [, month, day, year, hour, minute, meridiem, zone] = m
  if (+hour < 1 || +hour > 12 || +minute > 59 || +month < 1 || +month > 12 || +day < 1 || +day > 31) return NaN
  const h = +hour % 12 + (meridiem === 'PM' ? 12 : 0)
  const date = new Date(Date.UTC(2000 + +year, +month - 1, +day, h, +minute))
  if (date.getUTCDate() !== +day || date.getUTCMonth() !== +month - 1) return NaN
  return date.getTime() + (zone === 'CDT' ? 5 : 6) * 3600000
}

// Returns a plan only; no writes. Ambiguity is checked against ALL orders, not just eligible ones.
export async function planAutomaticShipping(rows, orders, receipts = [], now = Date.now()) {
  const result = { groups: [], exceptions: [], skipped: 0, unchanged: 0, alreadyImported: 0 }
  const groups = new Map(), identities = new Map(), previous = new Map()
  for (const receipt of receipts) for (const key of receipt.source_keys || []) previous.set(key, receipt)
  for (const row of rows) {
    if (!identities.has(row.identity)) identities.set(row.identity, [])
    identities.get(row.identity).push(row)
  }
  const unique = [...identities.values()].map(items => items[0])
  const addException = (row, reason, order) => result.exceptions.push({ row: row.row, name: row.name, cost: row.cost, reason, orderId: order?.id,
    potentialOrderIds: orders.filter(o => (row.name && exact(o.name) === exact(row.name)) || (row.email && exact(o.email) === exact(row.email)) || (row.tracking && tracking(o.tracking_number) === row.tracking)).map(o => String(o.id)),
  })
  for (const row of unique) {
    const copies = identities.get(row.identity)
    // A shared label identity does not prove that every copy names the same
    // recipient. Check all copies before discarding any or consulting receipts.
    // Missing versus supplied identifiers also require review: never let row
    // order decide whether the more informative copy gets checked.
    const recipientConflict = copies.some(r => exact(r.name) !== exact(row.name) || exact(r.email) !== exact(row.email) || tracking(r.tracking) !== tracking(row.tracking))
    const sourceConflict = copies.some(r => r.cost !== row.cost || /refund|void|cancel/i.test(`${r.raw.Type || ''} ${r.raw.Status || ''} ${r.raw['Label Status'] || ''}`))
    if (recipientConflict || sourceConflict) {
      // Retain every conflicting row so possible orders for ALL recipients are
      // excluded from other partial shipment totals later in this plan.
      for (const copy of copies) addException(copy, recipientConflict
        ? 'Copies of this label disagree on recipient details; no cost saved.'
        : 'Conflicting or refunded copies of this label; no cost saved.')
      continue
    }
    result.skipped += copies.length - 1
    if (isLedger(row) && !['label', 'refund'].includes(exact(row.raw.Type)) && !/refund|void|cancel/i.test(row.raw.Type)) { result.skipped++; continue }
    if (row.blocked) { addException(row, row.blocked); continue }
    row.sourceKey = await shippingSourceKey(row.identity)
    const receipt = previous.get(row.sourceKey)
    if (receipt) {
      const oldLabel = receipt.labels?.find(l => l.source_key === row.sourceKey)
      if (!oldLabel || oldLabel.cost_cents !== row.cost) addException(row, 'This imported label has a different cost in the saved history; review it manually.')
      else if (!orders.some(o => String(o.id) === String(receipt.order_id) && o.actual_shipping_cost_cents === receipt.after_cost)) addException(row, 'This label was imported before, but the order cost has since changed; check the order.')
      else result.alreadyImported++
      continue
    }
    let matches = [], method = ''
    const byTracking = row.tracking ? orders.filter(o => tracking(o.tracking_number) === row.tracking) : []
    if (byTracking.length) { matches = byTracking; method = 'tracking' }
    else if (row.name && row.email) { matches = orders.filter(o => exact(o.name) === exact(row.name) && exact(o.email) === exact(row.email)); method = 'recipient' }
    else if (isLedger(row) && row.name) {
      // The user's ledger has no email/tracking. Never remove punctuation, fuzzy match,
      // choose the newest order, or discard other same-name orders to force a match.
      matches = orders.filter(o => exact(o.name) === exact(row.name)); method = 'ledger'
    }
    if (matches.length !== 1) { addException(row, matches.length > 1 ? 'More than one order matches this recipient or tracking number.' : 'No reliable matching order.'); continue }
    const order = matches[0]
    if (!isRecordedPaidOrder(order)) { addException(row, 'Order is unpaid, cancelled, refunded or otherwise ineligible.', order); continue }
    if (method === 'tracking' && ((row.name && exact(row.name) !== exact(order.name)) || (row.email && exact(row.email) !== exact(order.email)))) { addException(row, 'Tracking and recipient details disagree.', order); continue }
    if (method === 'recipient' && row.tracking && order.tracking_number && tracking(order.tracking_number) !== row.tracking) { addException(row, 'Recipient matches, but the existing tracking number differs.', order); continue }
    if (method === 'ledger') {
      const labelCount = String(row.raw.Description).match(/:\s*(\d+)\s*Label\s*Batch\s*$/i)?.[1]
      const date = ledgerTimestamp(row.raw.Date), created = Date.parse(order.created_at)
      const sameRecipientLabels = unique.filter(r => isLedger(r) && exact(r.raw.Type) === 'label' && exact(r.name) === exact(row.name))
      if (labelCount !== '1' || sameRecipientLabels.length !== 1) { addException(row, 'Multiple labels for this recipient need a shipping-total check.', order); continue }
      if (!Number.isFinite(date) || !Number.isFinite(created) || date < created || date - created > 30 * 86400000 || date > now) { addException(row, 'Label date does not safely align with the order date.', order); continue }
    }
    const id = String(order.id)
    if (!groups.has(id)) groups.set(id, { order, rows: [], total: 0 })
    const group = groups.get(id); group.rows.push(row); group.total += row.cost
  }
  for (const group of groups.values()) {
    // Without an explicit shipment/order identifier we cannot prove a multi-label total.
    // Keep the entire order untouched rather than saving the first label or a partial sum.
    const uncertain = result.exceptions.some(e => String(e.orderId) === String(group.order.id) || e.potentialOrderIds.includes(String(group.order.id)))
    const priorOrder = receipts.some(r => String(r.order_id) === String(group.order.id))
    if (group.rows.length !== 1 || uncertain || priorOrder) {
      for (const row of group.rows) addException(row, 'Additional or unresolved shipments require a complete shipping-total check.', group.order)
    } else if (group.order.actual_shipping_cost_cents === group.total) result.unchanged++
    else if (group.order.actual_shipping_cost_cents != null) {
      addException(group.rows[0], 'An actual shipping cost is already recorded and differs; it was not overwritten.', group.order)
    } else result.groups.push(group)
  }
  return result
}

export async function loadShippingImportContext(client) {
  const [orders, receipts] = await Promise.all([
    readAttentionRows(client, 'orders'),
    readAttentionRows(client, 'shipping_import_receipts', 'id,order_id,source_keys,labels,after_cost,after_tracking'),
  ])
  return { orders, receipts }
}

export async function applyAutomaticShipping(client, plan, filename, onProgress = () => {}) {
  const results = []
  for (const group of plan.groups) {
    try {
      // Existing RPC's null-safe before-value guard rejects concurrent edits.
      // Passing the snapshot tracking unchanged means importing never replaces it.
      const data = await saveShippingGroup(client, group, group.order.tracking_number ?? null, filename)
      results.push({ orderId: group.order.id, name: group.order.name, row: group.rows[0].row, status: data.status })
    } catch (e) {
      // Failures stay exceptions. Successful earlier groups remain committed and auditable.
      results.push({ orderId: group.order.id, name: group.order.name, row: group.rows[0].row, status: 'error', reason: e.message })
    }
    onProgress(results.length, plan.groups.length)
  }
  return results
}
