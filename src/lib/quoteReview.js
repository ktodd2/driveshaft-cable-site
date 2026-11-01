export const normalizeEmail = value => String(value || '').trim().toLowerCase()
const unique = rows => [...new Map(rows.map(row => [String(row.id), row])).values()]
const dateValue = value => Date.parse(value) || 0
export function quoteReview(quote, sources) {
  const email = normalizeEmail(quote.email)
  const matches = key => unique(sources[key]?.rows || []).filter(row => email && normalizeEmail(row.email) === email)
  const orders = matches('orders')
  const sends = matches('sends')
  const quotes = matches('quotes')
  const optedOut = matches('preferences').some(row => row.status === 'unsubscribed' || row.unsubscribed_at)
  const incomplete = ['orders', 'sends', 'preferences'].some(key => !sources[key] || sources[key].error)
  const events = [
    ...quotes.map(row => ({ id: `quote-${row.id}`, at: row.created_at, source: 'Quote form', text: `Quote #${row.id}: ${row.message || 'No message supplied'}`, href: `#quote-${row.id}` })),
    ...orders.map(row => ({ id: `order-${row.id}`, at: row.created_at, source: 'Store order · possible email match', text: `Order ${String(row.id).slice(0, 8)} · ${row.payment_status || 'payment unknown'} · ${row.status || 'status unknown'}${Number.isFinite(Date.parse(row.created_at)) && Number.isFinite(Date.parse(quote.created_at)) && Date.parse(row.created_at) < Date.parse(quote.created_at) ? ' · predates this quote' : ''}`, href: `/admin/orders?order=${encodeURIComponent(row.id)}` })),
    ...sends.map(row => ({ id: `send-${row.id}`, at: row.sent_at, source: 'Campaign recipient log', text: `Campaign #${row.campaign_id}, cycle ${row.cycle} · provider accepted; delivery and reply unknown` })),
  ].sort((a, b) => dateValue(b.at) - dateValue(a.at) || a.id.localeCompare(b.id))
  const latestSend = sends.filter(row => dateValue(row.sent_at)).sort((a,b) => dateValue(b.sent_at)-dateValue(a.sent_at))[0]
  const nextAction = optedOut ? 'Opt-out recorded. Review preferences; do not send marketing follow-ups.'
    : incomplete ? 'Refresh unavailable sources before deciding whether to follow up.'
    : orders.length ? 'Review possible order matches and your inbox before contacting this person.'
    : ['converted', 'declined'].includes(quote.status) ? 'Closed quote status. Verify history before any further contact.'
    : 'Check your inbox for prior replies and confirm this request is still open before following up.'
  return { orders, events, latestSend, optedOut, incomplete, nextAction }
}
