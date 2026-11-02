import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminNavigation from './AdminNavigation'
import { displayDate, filterSuggestions, reviewHints, safeMailto, textValue } from '../../lib/suggestionReview'
const views=[['new','New inbox'],['review','Review hints & quarantine'],['quarantined','Quarantine'],['all','All submissions']]
export default function SuggestionReview({client=supabase}) {
 const [params,setParams]=useSearchParams()
 const latestParams=useRef(params)
 useLayoutEffect(()=>{latestParams.current=params},[params])
 const view=views.some(([key])=>key===params.get('view'))?params.get('view'):'new'
 const search=params.get('q') || '', selected=params.get('item')
 const [data,setData]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState(''), [busy,setBusy]=useState(false), [confirm,setConfirm]=useState(null), [notice,setNotice]=useState(''),[clock,setClock]=useState(Date.now())
 const generation=useRef(0), locked=useRef(false),mounted=useRef(true)
 const stale=data && clock-Date.parse(data.checked_at)>300000
 async function load(){
  const request=++generation.current;setLoading(true);setError('');setConfirm(null)
  try {const result=await client.rpc('get_suggestion_review');if(result.error || !Array.isArray(result.data?.rows) || !result.data?.counts) throw Error()
   if(request===generation.current){setData(result.data);setClock(Date.now())}
  }catch{if(request===generation.current)setError('Review unavailable. Check active admin access and refresh. Previously loaded records may be stale.')}
  finally{if(request===generation.current)setLoading(false)}
 }
 useEffect(()=>{mounted.current=true;load();const timer=setInterval(()=>setClock(Date.now()),30000);return()=>{mounted.current=false;generation.current++;clearInterval(timer)}},[client])
 useEffect(()=>setConfirm(null),[selected,view,search])
 const change=(key,value)=>{const next=new URLSearchParams(latestParams.current);value?next.set(key,value):next.delete(key);if(key!=='item')next.delete('item');latestParams.current=next;setConfirm(null);setParams(next,{replace:key==='q'})}
 async function act(row,action){
  if(locked.current || loading || error || stale)return
  locked.current=true;setBusy(true);setConfirm(null);setNotice('')
  try{const result=await client.rpc('review_suggestion',{p_id:row.id,p_revision:row.review_revision,p_action:action});if(result.error)throw Error(result.error.code==='40001'?'conflict':'unknown')
   if(mounted.current){setNotice('Decision saved. Original submission preserved.');window.dispatchEvent(new Event('suggestions-changed'));await load()}
  }catch(e){if(mounted.current)setError(e.message==='conflict'?'This record changed in another session. Refresh and review it again; your decision was not applied.':'Save outcome could not be confirmed. Refresh to check the saved record before another action.')}
  finally{locked.current=false;if(mounted.current)setBusy(false)}
 }
 const rows=data?.rows || [], filtered=filterSuggestions(rows,view,search), detail=selected?rows.find(row=>row.id===selected):null
 const disabled=busy || loading || !!error || !!stale
 return <>
 <AdminNavigation snapshot={loading || error || stale ? null:data} client={client}/>
 <main className="max-w-6xl mx-auto p-4 sm:p-8 text-gray-200 min-w-0">
  <div className="flex justify-between flex-wrap gap-3"><h1 className="text-3xl font-industrial text-white">SUGGESTIONS</h1><button className="text-yellow-400 underline" disabled={busy || loading} onClick={load}>{loading?'Loading…':'Refresh suggestions'}</button></div>
  <p className="my-3">New inbox counts submissions marked New outside manual quarantine. Hints are uncertain and never hide buying requests. Quarantine preserves the original message and status; it does not unsubscribe anyone.</p>
  {data && <p className="text-sm text-gray-400">{data.counts.total} total · {data.counts.attention} new outside quarantine · {data.counts.quarantined} quarantined · Checked {displayDate(data.checked_at)}{(stale || error || loading)?' · Snapshot may be stale; refresh before deciding.':''}</p>}
  {error && <p role="alert" className="my-4 text-red-300">{error}</p>}
  {notice && <p role="status" className="my-3 text-green-300">{notice}</p>}
  <div className="my-4 flex flex-wrap gap-2" aria-label="Suggestion views">{views.map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>change('view',key)} className={`px-3 py-2 border ${view===key?'border-yellow-400 text-yellow-400':'border-gray-600'}`}>{label}</button>)}</div>
  <label className="block">Search submissions<input value={search} onChange={e=>change('q',e.target.value)} className="block my-2 p-2 bg-gray-900 border border-gray-600 w-full" type="search" /></label>
  <p className="text-sm my-3">Hints use message content only: executable markup, three or more links, or missing/numeric-only context. Names, language and short messages are never spam signals. A kept/restored decision dismisses hints.</p>
  {selected && <button className="text-yellow-400 underline mb-3" onClick={()=>change('item',null)}>Close details</button>}
  {selected && data && !detail && <p role="status">Submission is no longer available in this snapshot. Close details or refresh.</p>}
  {!selected && data && <p className="my-2">{filtered.length} matching submissions</p>}
  {!selected && data && filtered.length===0 && <p className="p-6 border border-gray-700">No submissions match this view and search.</p>}
  <div className="space-y-4">{(selected?(detail?[detail]:[]):filtered).map(row=>{
   const hints=reviewHints(row),mail=safeMailto(row.email)
   return <article key={row.id} className="border border-gray-700 bg-gray-900 p-4 break-words min-w-0" aria-label={`Submission ${row.id}`}>
    <h2 className="text-lg font-bold">{textValue(row.name) || 'Name not supplied'}</h2>
    <p className="break-all">{textValue(row.email) || 'Email not supplied'}</p>
    <p className="text-sm text-gray-400">{displayDate(row.created_at)} · Status: {textValue(row.status) || 'Unknown'} · Review: {textValue(row.review_state) || 'unreviewed'}</p>
    {hints.map(hint=><p key={hint} className="my-2 text-yellow-300">{hint}</p>)}
    <p className="whitespace-pre-wrap my-3 [overflow-wrap:anywhere]">{textValue(row.message) || 'No message supplied'}</p>
    {!selected ? <button className="text-yellow-400 underline" onClick={()=>change('item',row.id)}>Review submission</button> : <>
     {row.reviewed_at && <p className="text-sm mb-3">Last decision: {displayDate(row.reviewed_at)}</p>}
     <div className="flex flex-wrap gap-3 [&>button]:border [&>button]:border-gray-500 [&>button]:px-3 [&>button]:py-2 [&>button:disabled]:opacity-50">
     {row.review_state==='quarantined'?<button disabled={disabled} onClick={()=>act(row,'restore')}>Restore & keep</button>:<><button disabled={disabled || row.review_state==='kept'} onClick={()=>act(row,'keep')}>Keep / dismiss hints</button><button disabled={disabled} onClick={()=>setConfirm(row.id)}>Quarantine…</button></>}
     {row.status!=='read' && <button disabled={disabled} onClick={()=>act(row,'read')}>Mark read</button>}
     {row.status!=='new' && <button disabled={disabled} onClick={()=>act(row,'new')}>Mark new</button>}
     {row.status!=='archived' && <button disabled={disabled} onClick={()=>act(row,'archive')}>Archive</button>}
     {mail && <a className="text-yellow-400 underline" href={mail}>Reply via email</a>}
     </div>
     {confirm===row.id && <div className="mt-4 border border-yellow-500 p-3"><p>Move this one submission out of the new inbox? Its text and status stay saved. Restore it from Quarantine at any time.</p><button disabled={disabled} className="mr-4 text-yellow-400 underline" onClick={()=>act(row,'quarantine')}>Confirm quarantine</button><button onClick={()=>setConfirm(null)}>Cancel</button></div>}
    </>}
   </article>
  })}</div>
 </main></>
}
