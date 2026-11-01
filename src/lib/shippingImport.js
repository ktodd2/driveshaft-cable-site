// Pure review logic: suggestions never authorize a write.
const clean = value => String(value ?? '').trim()
const norm = value => clean(value).toLowerCase()
const pick = (row, names) => names.map(name => row[name]).find(v => v != null && clean(v) !== '')
export function parseShippingMoney(value, { ledger = false } = {}) {
  const input = clean(value)
  if (!/^-?\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(input)) return null
  const text = input.replace(/[$,]/g, '')
  const cents = Math.round(Number(text) * 100)
  return Number.isSafeInteger(cents) && (ledger || cents >= 0) && Math.abs(cents) <= 2147483647 ? Math.abs(cents) : null
}
export function reviewShippingRows(data, orders) {
  const seen = new Set()
  const rows = data.map((raw, index) => {
    const ledger = 'Type' in raw && 'Description' in raw
    const description = clean(raw.Description)
    const name = ledger ? description.replace(/:\s*\d+\s*Label\s*Batch\s*$/i, '') : clean(pick(raw, ['Full Name', 'Name', 'Recipient', 'Ship To Name']))
    const rawTracking = pick(raw, ['Tracking Number', 'Tracking', 'Tracking #'])
    const tracking = clean(rawTracking).toUpperCase()
    const email = clean(pick(raw, ['Email', 'E-mail', 'Buyer Email']))
    const transaction = clean(pick(raw, ['Transaction ID', 'Label ID', 'Shipment ID']))
    const cost = parseShippingMoney(pick(raw, ['Total', 'Cost', 'Postage', 'Ship Cost', 'Amount', 'Label Cost', 'Shipping Cost']), { ledger })
    const status = clean(pick(raw, ['Status', 'Label Status']))
    let blocked = ''
    if (/refund|void|cancel/i.test(`${raw.Type || ''} ${status}`)) blocked = 'Refund, void or cancellation: reconcile this label outside the import.'
    else if (ledger && norm(raw.Type) !== 'label') blocked = 'Non-label transaction; excluded.'
    else if (typeof rawTracking === 'number') blocked = 'Tracking must be stored as text in XLSX to preserve every digit. Re-export as CSV or correct the spreadsheet.'
    else if (tracking && !/^[A-Z0-9][A-Z0-9 -]{0,99}$/.test(tracking)) blocked = 'Invalid tracking number: use letters, digits, spaces or hyphens (maximum 100 characters). Formula and markup values are excluded.'
    else if (cost == null) blocked = 'Missing or invalid shipping cost; use a nonnegative amount with at most two decimals.'
    // A ledger batch is an aggregate, not an individual label. Never invent its tracking.
    const identity = tracking ? `tracking:${tracking}` : transaction ? `transaction:${transaction}` : `row:${JSON.stringify(Object.entries(raw).map(([k,v]) => [clean(k), clean(v)]).sort(([a],[b]) => a.localeCompare(b)))}`
    if (seen.has(identity)) blocked = 'Duplicate source label or identical source row in this file.'
    seen.add(identity)
    const candidates = orders.map(order => {
      const sameTracking = tracking && tracking === clean(order.tracking_number).toUpperCase()
      const sameName = name && norm(name) === norm(order.name)
      const sameEmail = email && norm(email) === norm(order.email)
      const score = sameTracking ? 3 : sameName && sameEmail ? 2 : sameName || sameEmail ? 1 : 0
      return { id: String(order.id), score, reason: sameTracking ? 'Exact tracking' : sameName && sameEmail ? 'Exact name and email' : sameName ? 'Same name' : 'Same email' }
    }).filter(c => c.score).sort((a,b) => b.score - a.score)
    return { id: String(index + 2), row: index + 2, raw, name, email, tracking, cost, identity, identityKind: tracking ? 'tracking' : transaction ? 'transaction' : 'row fingerprint', candidates, blocked, reason: blocked || (candidates.length > 1 ? 'Multiple possible orders: choose explicitly.' : candidates.length ? 'Suggested match: confirm the order below.' : 'No matching order: search and select an order.') }
  })
  // A refund in the same file must also stop its original label, regardless of row order.
  const reversed = new Set(rows.filter(r => /refund|void|cancel/i.test(`${r.raw.Type || ''} ${r.raw.Status || ''} ${r.raw['Label Status'] || ''}`)).map(r => r.identity))
  const reversedNames = new Set(rows.filter(r => /refund|void|cancel/i.test(`${r.raw.Type || ''} ${r.raw.Status || ''} ${r.raw['Label Status'] || ''}`) && r.identityKind === 'row fingerprint').map(r => norm(r.name)).filter(Boolean))
  for (const row of rows) if (reversed.has(row.identity) || (row.identityKind === 'row fingerprint' && reversedNames.has(norm(row.name)))) row.blocked = row.reason = 'This source also has a refund or void in the file; reconcile manually.'
  return rows
}
export function groupShippingSelections(rows, choices, orders) {
  const groups = new Map()
  for (const row of rows) {
    const id = choices[row.id]
    if (!id || row.blocked) continue
    const order = orders.find(o => String(o.id) === id)
    if (!order) throw new Error('Selected order is no longer available. Refresh the review.')
    if (!groups.has(id)) groups.set(id, { order, rows: [], total: 0 })
    const group = groups.get(id)
    group.rows.push(row)
    if (group.rows.length > 1000) throw new Error('Select no more than 1,000 source rows per order.')
    group.total += row.cost
    if (!Number.isSafeInteger(group.total) || group.total > 2147483647) throw new Error('Combined shipping cost is too large.')
  }
  return [...groups.values()]
}
export async function shippingSourceKey(identity) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
}
// Each order group is atomic on the server. A retry reuses the same source keys.
export async function saveShippingGroup(client, group, tracking, filename) {
  const labels = await Promise.all(group.rows.map(async row => ({ source_key: await shippingSourceKey(row.identity), cost_cents: row.cost, tracking: row.tracking || null, source_row: row.row, identity_kind: row.identityKind })))
  const { data, error } = await client.rpc('apply_shipping_import', {
    p_order_id: String(group.order.id), p_expected_cost: group.order.actual_shipping_cost_cents ?? null,
    p_expected_tracking: group.order.tracking_number ?? null, p_tracking: tracking,
    p_labels: labels, p_filename: filename,
  })
  if (error) throw new Error(error.message || 'Save failed; retry the same review safely.')
  if (!data || !['saved', 'already_applied'].includes(data.status)) throw new Error('Save outcome unknown; retry this same review to verify.')
  return data
}
