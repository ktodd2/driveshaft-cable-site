import React, { useMemo, useState } from 'react'
import { parsePirateShipFile } from '../../lib/csvParser'
import { groupShippingSelections, saveShippingGroup } from '../../lib/shippingImport'
import { supabase } from '../../lib/supabase'

const money = cents => cents == null ? 'Not recorded' : `$${(cents / 100).toFixed(2)}`
const orderLabel = o => `${o.name || 'Unnamed'} · ${o.email || 'No email'} · ${String(o.created_at || '').slice(0, 10)} · #${o.id}`
const control = 'w-full min-w-0 bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white'
export default function ShippingImportReview({ orders, onSaved, client = supabase }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [choices, setChoices] = useState({})
  const [confirmations, setConfirmations] = useState({})
  const [tracking, setTracking] = useState({})
  const [results, setResults] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')
  async function loadHistory() {
    setHistoryError('')
    try {
      const { data, error } = await client.from('shipping_import_receipts').select('id,order_id,created_at,filename,before_cost,after_cost,before_tracking,after_tracking,labels').order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      setHistory(data || [])
    } catch (e) { setHistory(null); setHistoryError(`Could not load saved import history: ${e.message}`) }
  }
  // Keep the reviewed before-values stable through partial saves and retries.
  const [snapshot, setSnapshot] = useState([])
  const { groups, groupingError } = useMemo(() => {
    try { return { groups: groupShippingSelections(rows, choices, snapshot), groupingError: '' } }
    catch (e) { return { groups: [], groupingError: e.message } }
  }, [rows, choices, snapshot])
  const reset = () => { setRows([]); setChoices({}); setConfirmations({}); setTracking({}); setResults({}); setError('') }
  async function preview() {
    setBusy(true); reset()
    try { setRows(await parsePirateShipFile(file, orders)); setSnapshot(orders.map(o => ({ ...o }))) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  async function save() {
    setBusy(true); setError('')
    for (const group of groups) {
      const id = String(group.order.id)
      if (!confirmations[id] || results[id]?.ok) continue
      try {
        const result = await saveShippingGroup(client, group, tracking[id] ?? group.order.tracking_number ?? null, file.name)
        setResults(prev => ({ ...prev, [id]: { ok: true, message: result.status === 'already_applied' ? 'Already saved; nothing applied twice.' : 'Saved cost and tracking. No email sent.' } }))
      } catch (e) { setResults(prev => ({ ...prev, [id]: { ok: false, message: `${e.message} No further groups were attempted. Retry this same review if the connection failed; refresh and preview again for a changed-order conflict.` } })); break }
    }
    setBusy(false)
    onSaved?.()
  }
  const attempted = Object.keys(results).length > 0
  const pending = groups.filter(g => confirmations[String(g.order.id)] && !results[String(g.order.id)]?.ok).length
  function exportReview() {
    const blob = new Blob([JSON.stringify({ filename: file?.name, exportedAt: new Date().toISOString(), rows, choices, results }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'shipping-review.json'; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="bg-gray-800/50 border border-gray-700 mb-8">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full flex justify-between gap-3 p-6 text-left">
      <h2 className="text-xl font-industrial text-yellow-500">BULK SHIPPING IMPORT</h2><span className="text-gray-400">{open ? 'Hide' : 'Show'}</span>
    </button>
    {open && <div className="p-4 sm:p-6 border-t border-gray-700 space-y-4 text-gray-300">
      <p>Review Pirate Ship CSV or XLSX labels, choose each order, then confirm its shipping total and tracking together. Saving does not send customer emails or mark orders shipped.</p>
      <p className="text-sm text-yellow-300">Review choices remain only while this page is open. Download the review before leaving if you need a record of unresolved rows. Saved imports have a server audit record; unresolved rows are not saved to the dashboard queue.</p>
      <fieldset disabled={busy} className="flex flex-col sm:flex-row gap-3 min-w-0">
        <input aria-label="Shipping file" type="file" accept=".csv,.xlsx" className={`${control} flex-1`} onChange={e => { setFile(e.target.files?.[0] || null); reset() }} />
        <button className="bg-yellow-500 text-black font-bold p-2 disabled:opacity-50" disabled={!file || busy} onClick={preview}>Parse &amp; Preview</button>
      </fieldset>
      <button type="button" onClick={loadHistory} className="text-yellow-400 underline">Load recent saved imports</button>
      {historyError && <p role="alert" className="text-red-300">{historyError}</p>}
      {history && <div className="space-y-2"><h3 className="font-bold">Latest 20 saved imports</h3>{!history.length && <p>No saved imports yet.</p>}{history.map(item => <details key={item.id} className="border border-gray-600 p-3 break-words"><summary>#{item.order_id} · {money(item.before_cost)} → {money(item.after_cost)} · {new Date(item.created_at).toLocaleString()}</summary><p>File: {item.filename}</p><p>Tracking: {item.before_tracking || 'none'} → {item.after_tracking || 'none'}</p>{item.labels.map((label, i) => <p key={i} className="text-sm break-all">Row {label.source_row}: {money(label.cost_cents)} · {label.tracking || 'No tracking'} · Source {label.source_key}</p>)}</details>)}</div>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {rows.length > 0 && <>
        <div className="flex flex-wrap gap-3 items-center">
          <p>{rows.length} source rows · {rows.filter(r => r.blocked).length} excluded · {rows.filter(r => !r.blocked && !choices[r.id]).length} awaiting a choice</p>
          <button onClick={exportReview} className="text-yellow-400 underline">Download review</button>
          <button disabled={busy} onClick={reset} className="underline disabled:opacity-50">Clear review / cancel remaining</button>
        </div>
        <label className="block">Search orders by name, email or order ID<input className={control} value={search} onChange={e => setSearch(e.target.value)} /></label>
        <div className="space-y-3">
          {rows.map(row => <article key={row.id} className="border border-gray-600 rounded p-3 space-y-2 break-words">
            <p className="font-bold">Row {row.row}: {row.name || 'No recipient'} — {money(row.cost)}</p>
            <p className="text-sm">{row.tracking || 'No tracking in source'} · Identified by {row.identityKind}</p>
            <p className={row.blocked ? 'text-red-300 text-sm' : 'text-yellow-300 text-sm'}>{row.reason}</p>
            {!row.blocked && <label className="block text-sm">Confirm order for row {row.row}
              <select aria-label={`Order for row ${row.row}`} className={control} value={choices[row.id] || ''} disabled={busy || attempted} onChange={e => { setChoices(prev => ({ ...prev, [row.id]: e.target.value })); setConfirmations({}); setTracking({}) }}>
                <option value="">Leave unresolved — do not import</option>
                {row.candidates.length > 0 && <optgroup label="Suggested matches — verify before selecting">{row.candidates.map(c => { const o = snapshot.find(o => String(o.id) === c.id); return <option key={c.id} value={c.id}>{c.reason}: {orderLabel(o)}</option> })}</optgroup>}
                <optgroup label="All matching orders">{snapshot.filter(o => !row.candidates.some(c => c.id === String(o.id)) && orderLabel(o).toLowerCase().includes(search.toLowerCase())).map(o => <option key={o.id} value={String(o.id)}>{orderLabel(o)}</option>)}</optgroup>
              </select>
            </label>}
          </article>)}
        </div>
        {groupingError && <p role="alert" className="text-red-300">{groupingError}</p>}
        {groups.map(group => { const id = String(group.order.id); const current = group.order.tracking_number ?? ''; return <article key={id} className="bg-gray-900 p-4 border border-yellow-700 rounded space-y-3 break-words">
          <h3 className="font-bold">Save to {orderLabel(group.order)}</h3>
          <p>{group.rows.length} selected source row(s). Current cost: {money(group.order.actual_shipping_cost_cents)}. New order total: <strong>{money(group.total)}</strong>.</p>
          <p className="text-sm">This replaces the order’s entire shipping cost, including any previous labels. Include all applicable labels in the total. Multiple labels are combined once; refunds and voids must be reconciled separately.</p>
          <label className="block">Tracking to save
            <select className={control} disabled={busy || attempted} value={tracking[id] ?? current} onChange={e => { setTracking(prev => ({ ...prev, [id]: e.target.value || null })); setConfirmations(prev => ({ ...prev, [id]: false })) }}>
              <option value={current}>Keep existing: {current || 'none'}</option>
              {[...new Set(group.rows.map(r => r.tracking).filter(t => t && t !== current))].map(t => <option key={t} value={t}>Use source tracking: {t}</option>)}
            </select>
          </label>
          <p className="text-sm">Orders store one tracking number. Carrier stays {group.order.tracking_carrier || 'unset'}; change it on Orders if needed. Other selected label identities remain in the audit record. To email tracking, use the existing Orders page after saving.</p>
          <label className="flex gap-2 items-start"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 p-0" disabled={busy || attempted} checked={!!confirmations[id]} onChange={e => setConfirmations(prev => ({ ...prev, [id]: e.target.checked }))} /><span>I verified the order, complete shipping total and tracking choice{tracking[id] && current && tracking[id] !== current ? ', including replacing existing tracking' : ''}.</span></label>
          {results[id] && <p role="status" className={results[id].ok ? 'text-green-300' : 'text-red-300'}>{results[id].message}</p>}
        </article> })}
        <button disabled={busy || !pending} onClick={save} className="bg-yellow-500 text-black font-bold p-3 disabled:opacity-50">{busy ? 'Working…' : `Save confirmed orders (${pending}) — no email`}</button>
      </>}
    </div>}
  </section>
}
