import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { quoteReview } from '../../lib/quoteReview'
const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Date unknown'

export default function QuoteContactReview() {
  const [snapshot, setSnapshot] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState('')
  const [now, setNow] = useState(Date.now())
  const generation = useRef(0)
  const inFlight = useRef(false)
  async function refresh() {
    if (inFlight.current) return
    inFlight.current = true
    const current = ++generation.current
    setBusy(true); setSnapshot(null); setError(false)
    try {
      const { data, error } = await supabase.functions.invoke('quote-contact-review', { body: {} })
      if (error || !data?.sources || !data.checkedAt) throw Error('Unavailable')
      if (current === generation.current) setSnapshot(data)
    } catch { if (current === generation.current) setError(true) }
    finally { if (current === generation.current) { setBusy(false); inFlight.current = false } }
  }
  useEffect(() => {
    refresh()
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => { generation.current++; inFlight.current = false; clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (snapshot && window.location.hash.startsWith('#quote-')) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'center' })
  }, [snapshot])
  const sources = snapshot?.sources || {}
  const quotes = [...(sources.quotes?.rows || [])].sort((a,b) => Date.parse(a.created_at)-Date.parse(b.created_at))
  const visible = quotes.filter(q => `${q.name} ${q.email} ${q.company || ''}`.toLowerCase().includes(filter.toLowerCase()))
  return <section className="max-w-6xl mx-auto text-gray-300">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <h1 className="text-3xl font-industrial text-white">QUOTE REVIEW</h1>
      <button onClick={refresh} disabled={busy} className="bg-yellow-500 text-black font-bold rounded px-4 py-2 disabled:opacity-50">{busy ? 'Refreshing…' : 'Refresh records'}</button>
    </div>
    <p>Review purchases and previous contact before following up. Email matches are possible connections, not confirmed quote conversions or campaign attribution.</p>
    <p className="mt-2 text-sm">Gmail and Titan conversations are not synchronized. Last personal contact is unknown. Campaign logs do not prove delivery or a reply.</p>
    <p className="my-4 text-sm" role="status">{busy ? 'Loading review records…' : snapshot ? `Snapshot checked ${date(snapshot.checkedAt)}. Refresh before acting.` : 'No current snapshot.'}</p>
    {snapshot && now - Date.parse(snapshot.checkedAt) >= 300000 && <p role="status" className="text-yellow-300 mb-4">This snapshot is over 5 minutes old. Refresh before acting.</p>}
    {error && <p role="alert" className="text-red-300">Review unavailable. Check admin access and refresh to retry. No records were changed.</p>}
    {Object.entries(sources).filter(([,source]) => source.error).map(([key]) => <p role="alert" key={key} className="text-red-300 mb-2">{key} unavailable. This is not evidence of no history; refresh to retry.</p>)}
    {snapshot && !sources.quotes?.error && <>
      <label className="block my-4">Find a quote
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Name, email or company" className="block w-full mt-2 bg-gray-900 border border-gray-600 rounded p-3 text-white" />
      </label>
      <p className="mb-4">{visible.length} of {quotes.length} quotes · oldest first</p>
      {!quotes.length && <p>No quote requests in this snapshot.</p>}
      {!!quotes.length && !visible.length && <p>No quotes match your search.</p>}
      <div className="space-y-4">{visible.map(quote => {
        const review = quoteReview(quote, sources)
        return <article id={`quote-${quote.id}`} key={quote.id} className="scroll-mt-20 rounded border border-gray-700 bg-gray-900 p-4 sm:p-6 break-words">
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="text-xl font-bold text-white">{quote.name} · Quote #{quote.id}</h2>
            <span className="text-yellow-300">Status: {quote.status || 'new'}</span>
          </div>
          <p>{quote.email} · {quote.company || 'No company'}</p>
          <p className="text-sm mt-1">Requested {date(quote.created_at)} · Quantity: {quote.quantity || 'Not supplied'}</p>
          <p className="mt-3 whitespace-pre-wrap">{quote.message || 'No message supplied.'}</p>
          <dl className="grid sm:grid-cols-2 gap-4 my-4 text-sm">
            <div><dt className="text-gray-400">Last personal contact</dt><dd>Unknown — check your inbox</dd></div>
            <div><dt className="text-gray-400">Latest recorded campaign send</dt><dd>{sources.sends?.error ? 'Unavailable' : review.latestSend ? date(review.latestSend.sent_at) : 'No matching recipient log'}</dd></div>
            <div><dt className="text-gray-400">Possible order matches</dt><dd>{sources.orders?.error ? 'Unavailable' : review.orders.length} · exact normalized email only</dd></div>
            <div><dt className="text-gray-400">Marketing preference</dt><dd>{review.optedOut ? 'Opt-out recorded' : sources.preferences?.error ? 'Unavailable' : 'No opt-out found here; this is not consent'}</dd></div>
          </dl>
          <p className="rounded bg-yellow-500/10 border border-yellow-500/30 p-3 text-yellow-200"><strong>Suggested next action: </strong>{review.nextAction}</p>
          <details className="mt-4">
            <summary className="cursor-pointer text-yellow-400 py-2">Review history ({review.events.length} records)</summary>
            <p className="text-sm my-2">Includes other quotes and orders with the same email. Confirm identity and relevance. No personal replies or manual contact notes are stored here.</p>
            <ol className="space-y-3 mt-3">{review.events.map(event => <li key={event.id} className="border-l-2 border-gray-600 pl-3">
              <p className="text-xs text-gray-400">{event.source} · {date(event.at)}</p>
              {event.href?.startsWith('/admin/') ? <Link className="underline text-yellow-300" to={event.href}>{event.text}</Link> : event.href ? <a className="underline" href={event.href}>{event.text}</a> : <p>{event.text}</p>}
            </li>)}</ol>
          </details>
        </article>
      })}</div>
    </>}
  </section>
}
