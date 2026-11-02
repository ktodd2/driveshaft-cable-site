import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parsePirateShipFile } from '../../lib/csvParser'
import { loadShippingImportContext, planAutomaticShipping, applyAutomaticShipping } from '../../lib/automaticShippingImport'
import { supabase } from '../../lib/supabase'

export default function ShippingImportReview({ onSaved, client = supabase }) {
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [progress, setProgress] = useState('')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')
  async function upload(file) {
    if (!file || running.current) return
    running.current = true; setBusy(true); setSummary(null); setError(''); setProgress('Reading your file…')
    try {
      // Validate the entire file before any order can be saved.
      const rows = await parsePirateShipFile(file, [])
      setProgress('Matching your shipments…')
      const { orders, receipts } = await loadShippingImportContext(client)
      const plan = await planAutomaticShipping(rows, orders, receipts)
      const results = await applyAutomaticShipping(client, plan, file.name, (done, total) => setProgress(`Saving shipping costs… ${done} of ${total}`))
      setSummary({ filename: file.name, updated: results.filter(r => r.status === 'saved').length,
        unchanged: plan.unchanged + plan.alreadyImported + results.filter(r => r.status === 'already_applied').length,
        skipped: plan.skipped, exceptions: [...plan.exceptions, ...results.filter(r => r.status === 'error')] })
      onSaved?.()
    } catch (e) { setError(e.message || 'Unable to import this file. Please try again.') }
    finally { running.current = false; setBusy(false); setProgress('') }
  }
  async function loadHistory() {
    setHistoryError('')
    try {
    const { data, error } = await client.from('shipping_import_receipts').select('id,order_id,created_at,filename,after_cost').order('created_at', { ascending: false }).limit(20)
    if (error) { setHistory(null); setHistoryError('Could not load import history. Please try again.') }
    else setHistory(data || [])
    } catch { setHistory(null); setHistoryError('Could not load import history. Please try again.') }
  }
  return <section className="bg-gray-800/50 border border-gray-700 mb-8 p-4 sm:p-6 space-y-4" aria-labelledby="shipping-upload-title">
    <h2 id="shipping-upload-title" className="text-xl font-industrial text-yellow-500">BULK SHIPPING IMPORT</h2>
    <p className="text-gray-300">Upload your Pirate Ship file. Matching shipping costs are saved automatically.</p>
    <label className="block text-gray-300">Pirate Ship CSV or XLSX
      <input aria-label="Pirate Ship CSV or XLSX" type="file" accept=".csv,.xlsx" disabled={busy} className="block w-full min-w-0 mt-2 text-sm file:mr-3 file:px-3 file:py-2 file:bg-yellow-500 file:text-black file:border-0 file:rounded" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; upload(file) }} />
    </label>
    <p className="text-sm text-gray-400">Existing costs that differ are left for you to check. Tracking, order status and customer emails stay unchanged.</p>
    {busy && <p role="status" className="text-yellow-400">{progress} Keep this page open until the import finishes.</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {summary && <div className="space-y-3">
      <p role="status" className="text-white font-bold">{summary.updated} orders updated · {summary.unchanged} already recorded · {summary.exceptions.length} need attention</p>
      {summary.skipped > 0 && <p className="text-sm text-gray-400">{summary.skipped} payment, pickup or duplicate rows skipped.</p>}
      {summary.exceptions.length > 0 && <details open className="border border-gray-700 rounded p-3">
        <summary className="text-yellow-400 font-bold">Only these rows need attention</summary>
        <ul className="mt-3 space-y-3 text-sm text-gray-300">
          {summary.exceptions.map((row, i) => <li key={i} className="break-words"><strong>Row {row.row}: {row.name || 'Unknown recipient'}</strong><p>{row.reason}</p>{row.orderId && <Link className="text-yellow-400 underline" to={`/admin/orders?order=${encodeURIComponent(row.orderId)}`}>Open order</Link>}</li>)}
        </ul>
        <p className="text-xs text-gray-400 mt-3">Correct the file or check the order, then upload again. Previously saved labels will not be applied twice.</p>
      </details>}
    </div>}
    <details className="text-sm text-gray-400"><summary className="cursor-pointer">Import history</summary>
      <button type="button" onClick={loadHistory} className="text-yellow-400 underline my-3">Load recent imports</button>
      {historyError && <p role="alert">{historyError}</p>}
      {history && (!history.length ? <p>No saved imports yet.</p> : <ul className="space-y-2">{history.map(r => <li key={r.id} className="break-words">{r.filename} · ${(r.after_cost / 100).toFixed(2)} · {new Date(r.created_at).toLocaleDateString()}</li>)}</ul>)}
    </details>
  </section>
}
