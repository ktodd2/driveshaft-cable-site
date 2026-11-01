import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

const automations = [
  ['send-abandoned-cart','Cart recovery',2], ['send-welcome-series','Welcome series',1],
  ['send-reorder-reminder','Reorder reminder',48], ['send-winback','Win-back',192],
  [['dis','patch-campaigns'].join(''),'Campaign scheduling',2], ['check-tracking-status','Delivery tracking',36],
]
export const formatHealthTime = value => value ? `${new Date(value).toISOString().replace('T',' ').slice(0,19)} UTC` : 'Unknown — no recorded evidence'
export default function EmailHealth({ orderId = null, client = supabase }) {
  const [data,setData] = useState(null), [error,setError] = useState(''), [loading,setLoading] = useState(true)
  const [clock,setClock] = useState(Date.now())
  const generation = useRef(0)
  const load = async () => {
    const request = ++generation.current
    setLoading(true);setError('')
    try {
      const result = await client.rpc('get_email_health', { p_order_id: orderId === null ? null : String(orderId) })
      if(result.error || !result.data) throw Error('History unavailable. Check active admin access and whether the storage release is installed.')
      if (request === generation.current) { setData(result.data);setClock(Date.now()) }
    } catch(e) { if (request === generation.current) setError(e.message || 'History unavailable. Try refreshing.') }
    finally { if (request === generation.current) setLoading(false) }
  }
  useEffect(() => {setData(null);load();return () => { generation.current++ }}, [orderId,client])
  useEffect(() => {const timer=setInterval(()=>setClock(Date.now()),30000);return ()=>clearInterval(timer)},[])
  return <section className="bg-gray-900 border border-gray-700 p-4 mb-6 text-gray-200 min-w-0" aria-label="Saved email history">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="font-industrial text-xl text-yellow-500">{orderId ? 'SAVED TRACKING EMAIL HISTORY' : 'AUTOMATION HEALTH & EMAIL HISTORY'}</h2><button type="button" onClick={load} disabled={loading} className="text-yellow-400 underline">{loading?'Loading history…':'Refresh history'}</button></div>
    <p className="text-sm my-2">Provider accepted means accepted for processing, not delivered. Opening or refreshing this view never sends email.</p>
    {error && <p role="alert" className="text-red-300">{error} {data?'Previously loaded data below may be stale.':''}</p>}
    {data && <>
      <p className="text-xs text-gray-400">Checked: {formatHealthTime(data.checked_at)}{clock-Date.parse(data.checked_at)>300000?' · Stale snapshot — refresh to check again':''}</p>
      {!orderId && <><p className="text-sm my-3">Site email automations only. Assistant Gmail and Facebook review schedules are separate. Missing history does not mean an automation failed. Counts cover each recorded batch, not all customers. Campaign and delivery email attempts remain in their existing logs; individual provider outcomes for those routines are not instrumented here.</p>
        <div className="grid md:grid-cols-2 gap-3 my-4">{automations.map(([key,label,hours])=>{
          const summary=data.summary.find(row=>row.automation===key), latest=data.runs.find(row=>row.automation===key)
          const held=(data.held || []).find(row=>row.automation===key)?.attempts || 0
          const overdue=summary && hours && clock-Date.parse(summary.last_attempted)>hours*3600000
          return <article key={key} className="border border-gray-700 p-3 break-words"><h3 className="font-bold">{label}</h3>{held>0 && <p className="text-yellow-300">{held} attempts held for review; excluded before batch limits. No automatic resend.</p>}<p>{!hours?'Run instrumentation not installed for this routine':!summary?'Unknown — no recorded runs':overdue?'Stale execution evidence — review schedule':latest?.status==='running'?'Unfinished run — outcome requires review':latest?.status || 'Recorded'}</p><p className="text-xs">Last attempt: {formatHealthTime(summary?.last_attempted)}</p><p className="text-xs">Last completed without reported errors: {formatHealthTime(summary?.last_successful)}</p>{latest && <p className="text-sm">{Object.entries(latest.counts).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join(' · ') || 'Counts unknown'}{latest.reason?` · ${latest.reason.replaceAll('_',' ')}`:''}</p>}</article>
        })}</div>
        <details className="mb-4"><summary>Recent execution history (latest 100)</summary>{data.runs.length===0?<p>No recorded executions yet. No historical runs have been inferred.</p>:data.runs.map(run=><p key={run.id} className="text-sm border-b border-gray-700 py-2 break-words">{formatHealthTime(run.started_at)} · {run.automation} · {run.status} · {Object.entries(run.counts).map(([k,v])=>`${k}: ${v}`).join(' · ')} {run.reason}</p>)}</details>
      </>}
      <h3 className="font-bold mt-3">Email attempts (latest 100)</h3>
      {data.emails.length===0?<p>No saved attempts yet. Older send activity is not proof of delivery or execution history.</p>:<div className="space-y-3 mt-2">{data.emails.map(email=><article key={email.id} className="border border-gray-700 p-3 break-words text-sm"><p className="font-bold">{email.automation} · {email.status==='accepted'?'Provider accepted':email.status==='pending'?'Pending / outcome may be unknown':email.status}</p><p>{formatHealthTime(email.started_at)} · Record {email.entity_id}</p>{email.provider_id && <p className="break-all">Provider message: {email.provider_id}</p>}{email.reason && <p>{email.reason.replaceAll('_',' ')}</p>}{email.status!=='accepted' && <p className="text-yellow-300">Review provider evidence before retrying. This view cannot resend messages.</p>}</article>)}</div>}
    </>}
  </section>
}
