import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { oldestFirst, orderQueues, possibleQuotePurchases, readAttentionRows } from '../../lib/needsAttention'

function Queue({ title, source, rows, note, href, renderRow, unavailable }) {
  const [expanded, setExpanded] = useState(false)
  return <article className="min-w-0 rounded border border-gray-700 bg-gray-900 p-4">
    <h3 className="text-lg font-bold text-white">{title}</h3>
    <p className="my-2 text-2xl font-bold text-yellow-400">
      {unavailable || (source?.error ? 'Unavailable' : !source ? 'Loading…' : rows.length)}
    </p>
    <p className="text-sm text-gray-300">{note}</p>
    {source?.error && <p className="mt-2 text-sm text-red-300" role="alert">Could not load this source. Refresh to retry.</p>}
    {!unavailable && source && !source.error && <>
      {rows.length === 0 ? <p className="mt-3 text-sm text-gray-400">No matching records in this source.</p> :
        <ul className="mt-3 space-y-2 text-sm break-words">{oldestFirst(rows).slice(0, expanded ? rows.length : 5).map(renderRow)}</ul>}
      {rows.length > 5 && <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-3 text-yellow-400 underline">{expanded ? 'Show oldest 5' : `Show all ${rows.length} records`}</button>}
    </>}
    <Link className="mt-4 inline-block text-yellow-400 underline underline-offset-4" to={href} aria-label={`Open ${title.toLowerCase()} records`}>Open records →</Link>
  </article>
}

export default function NeedsAttention() {
  const [sources, setSources] = useState({})
  const [busy, setBusy] = useState(false)
  const [updated, setUpdated] = useState(null)
  const [now, setNow] = useState(Date.now())
  const generation = useRef(0)
  async function refresh() {
    const current = ++generation.current
    setBusy(true)
    setSources({})
    setUpdated(null)
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const queries = {
      orders: () => readAttentionRows(supabase, 'orders'),
      quotes: () => readAttentionRows(supabase, 'quote_requests', '*', q => q.eq('status', 'new')),
      emails: () => readAttentionRows(supabase, 'email_campaign_sends', '*', q => q.gte('sent_at', since).gt('failed_count', 0)),
    }
    await Promise.all(Object.entries(queries).map(async ([key, query]) => {
      let result
      try { result = { rows: await query() } } catch { result = { error: true, rows: [] } }
      if (current === generation.current) setSources(prev => ({ ...prev, [key]: result }))
    }))
    if (current === generation.current) { setBusy(false); setUpdated(Date.now()) }
  }
  useEffect(() => {
    refresh()
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => { generation.current++; clearInterval(timer) }
  }, [])
  const queues = orderQueues(sources.orders?.rows || [])
  const orderRow = order => <li key={order.id}>
    <Link className="text-gray-200 underline" to={`/admin/orders?order=${encodeURIComponent(order.id)}`}>
      {order.name || 'Order'} · {String(order.id).slice(0, 8)}
    </Link>
  </li>
  return <section aria-labelledby="attention-title" className="mb-8 rounded border border-yellow-500/40 bg-gray-800/50 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="attention-title" className="text-2xl font-industrial text-yellow-500">NEEDS ATTENTION</h2>
      <button onClick={refresh} disabled={busy} className="rounded bg-yellow-500 px-4 py-2 font-bold text-black disabled:opacity-50">{busy ? 'Refreshing…' : 'Refresh attention list'}</button>
    </div>
    <p className="mt-2 text-sm text-gray-300" role="status">{busy ? 'Checking available sources…' : updated ? `Checked ${new Date(updated).toLocaleTimeString()}. This list does not update automatically.` : 'Waiting for data.'}</p>
    {updated && now - updated >= 5 * 60000 && <p className="mt-2 text-sm text-yellow-300" role="status">This snapshot is over 5 minutes old. Refresh before acting.</p>}
    <p className="my-4 text-sm text-gray-300">Review records here; nothing is sent or changed automatically. Counts overlap and are not a total task count.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Queue title="Ready to review for fulfillment" source={sources.orders} rows={queues.fulfillment} renderRow={orderRow} href="/admin/orders"
        note="Confirmed, marked paid by the store, and no tracking. Check payment and refunds before shipping. The store does not provide a reliable test-order flag; verify unfamiliar orders." />
      <Queue title="Shipped without tracking" source={sources.orders} rows={queues.tracking} renderRow={orderRow} href="/admin/orders"
        note="Marked paid and shipped, but no tracking number. Review the shipment record; do not ship again." />
      <Queue title="Tracking with unshipped status" source={sources.orders} rows={queues.status} renderRow={orderRow} href="/admin/orders"
        note="Confirmed paid orders already have tracking. Check whether the order status needs updating before fulfillment." />
      <Queue title="Quotes to review" source={sources.quotes} rows={sources.quotes?.rows || []} href="/admin/quotes"
        note="Status is New. This does not prove an unanswered request: replies and purchases may not be linked. Check the conversation and orders before contacting anyone."
        renderRow={q => {
          const purchases = possibleQuotePurchases(q, sources.orders?.rows || [])
          return <li key={q.id}>
            <Link className="text-gray-200 underline" to={`/admin/quotes#quote-${q.id}`}>{q.name || 'Quote'} · #{q.id}</Link>
            {purchases.length > 0 && <p className="mt-1 text-yellow-300">Possible purchase after request (same email; verify): {purchases.map((order, index) => <React.Fragment key={order.id}>{index > 0 && ', '}<Link className="underline" to={`/admin/orders?order=${encodeURIComponent(order.id)}`}>{String(order.id).slice(0, 8)}</Link></React.Fragment>)}</p>}
            {sources.orders?.error && <p className="mt-1 text-gray-400">Purchase cross-check unavailable.</p>}
          </li>
        }} />
      <Queue title="Missing shipping costs" source={sources.orders} rows={queues.shipping} renderRow={orderRow} href="/admin#shipping-import"
        note="Paid confirmed, shipped or delivered orders without a recorded cost. Missing is not $0. Some may be unshipped or pickup orders; review before importing." />
      <Queue title="Email send failures" source={sources.emails} rows={sources.emails?.rows || []} href="/admin/email"
        note="Campaign runs reporting failures in the last 30 days. Historical failures may have been retried. This is not a complete delivery log for order, tracking or quote emails."
        renderRow={e => <li className="text-gray-200" key={e.id}>Campaign {e.campaign_id}: {e.failed_count} failed · {new Date(e.sent_at).toLocaleDateString()}</li>} />
      <Queue title="Unmatched shipping imports" rows={[]} unavailable="Not saved" href="/admin#shipping-import"
        note="Unmatched import rows are only available during an import session. Review the existing import tool; there is no saved backlog to count." />
      <Queue title="Low stock" rows={[]} unavailable="Not configured" href="/admin/orders"
        note="No reorder thresholds are configured in the current inventory model. Review stock in Orders; a low-stock count cannot be calculated reliably." />
    </div>
  </section>
}
