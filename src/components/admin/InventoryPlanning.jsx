import React, { useEffect, useRef, useState } from 'react'
import { useInventoryPlanning } from '../../hooks/useInventoryPlanning'
import { forecast, reconcileIncoming, incomingWarning, PLANNING_LIMITATIONS } from '../../lib/inventoryPlanning'
const field = 'bg-gray-950 border border-gray-600 rounded p-2 w-full text-white'
export function InventoryPlanningView({ data }) {
  const [days, setDays] = useState(30)
  const [lead, setLead] = useState('')
  const [safety, setSafety] = useState('')
  const [lines, setLines] = useState([])
  const [message, setMessage] = useState('')
  const [sharedMessage, setSharedMessage] = useState('Fetch the shared plan before editing across devices. Browser drafts are separate backups.')
  const [fetched, setFetched] = useState(null)
  const [revision, setRevision] = useState(null)
  const [sharedSnapshot, setSharedSnapshot] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef(null)
  const savedEditor = useRef(JSON.stringify({days:30,lead:'',safety:'',lines:[]}))
  const document = () => ({ days, lead, safety, lines })
  const fetchShared = async () => {
    setBusy(true)
    try {
      if (!data.readShared) throw Error('Shared storage is not installed. Browser drafts are available only on this device.')
      const result = await data.readShared(); setFetched(result)
      setSharedMessage(`Shared revision ${result.revision} fetched. Review it below; the editor has not changed.`)
    } catch(e) { setSharedMessage(e.message || 'Shared plan unavailable. Editor unchanged.'); setFetched(null) }
    finally { setBusy(false) }
  }
  const useShared = () => {
    try {
      // Never discard work silently. If the backup cannot be written, keep editor intact.
      localStorage.setItem('inventory-planning-before-shared', JSON.stringify(document()))
      const d=fetched.document
      savedEditor.current=JSON.stringify(d);setSharedSnapshot(JSON.stringify(d));setDays(d.days);setLead(d.lead);setSafety(d.safety);setLines(d.lines);setRevision(fetched.revision);setFetched(null)
      setSharedMessage(`Loaded shared revision ${fetched.revision}. Previous editor saved as a local recovery backup.`)
    } catch { setSharedMessage('Could not back up this editor. Shared plan not loaded; current work is unchanged.') }
  }
  const saveShared = async () => {
    if (revision===null || busy) return
    if (!pending.current) pending.current={p_request_id:crypto.randomUUID(),p_expected_revision:revision,p_document:document()}
    setBusy(true)
    try {
      const result=await data.writeShared(pending.current)
      const stillCurrent=JSON.stringify(document())===JSON.stringify(pending.current.p_document)
      savedEditor.current=JSON.stringify(pending.current.p_document);setSharedSnapshot(savedEditor.current);pending.current=null;setUncertain(false);setFetched(null)
      setRevision(result.current_revision===result.revision?result.revision:null)
      setSharedMessage(result.current_revision!==result.revision ? 'Your previous save succeeded, but another device has since updated the plan. Fetch and review the latest version.' : `Shared revision ${result.revision} saved. ${stillCurrent?'Available to active admins on Mac and phone.':'Newer editor changes are not yet saved.'} Inventory and costs unchanged.`)
    } catch(e) {
      if(e.definitive) {pending.current=null;setUncertain(false)} else setUncertain(true)
      setSharedMessage(e.message || 'Shared save failed. Editor preserved.')
    } finally {setBusy(false)}
  }
  const [clock, setClock] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(id) }, [])
  useEffect(() => { const warn=e=>{if(JSON.stringify(document())!==savedEditor.current || pending.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn) }, [days,lead,safety,lines])
  const patch = (index, change) => setLines(lines.map((line,i) => i === index ? { ...line, ...change } : line))
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('inventory-planning-v1'))
      if (!saved || !Array.isArray(saved.lines) || saved.lines.length > 100 || ![7,30,90].includes(saved.days) || saved.lines.some(l => !l || typeof l.reference !== 'string' || typeof l.productId !== 'string' || typeof l.etaStart !== 'string' || typeof l.etaEnd !== 'string' || !Array.isArray(l.receiptIds) || l.receiptIds.some(id=>typeof id !== 'string'))) throw Error()
      localStorage.setItem('inventory-planning-before-shared', JSON.stringify(document()))
      setLines(saved.lines.map(l=>({...l,id:l.id||crypto.randomUUID()}))); setDays(saved.days); setLead(typeof saved.lead==='string'?saved.lead:''); setSafety(typeof saved.safety==='string'?saved.safety:''); setMessage('Loaded browser-local draft. Review dates and receipt links before relying on it.')
    } catch { setMessage('No valid local draft available. Current plan unchanged.') }
  }
  const save = () => {
    try { localStorage.setItem('inventory-planning-v1', JSON.stringify({ days, lead, safety, lines })); savedEditor.current=JSON.stringify(document()); setMessage('Draft saved on this browser only. No inventory or costs changed.') }
    catch { setMessage('Unable to save locally. Keep this page open or copy your plan before leaving.') }
  }
  const stale = data.loadedAt && clock - new Date(data.loadedAt).getTime() > 15*60000
  const ready = !data.loading && !data.error && !stale
  const incoming = ready ? reconcileIncoming(lines, data.receipts) : []
  return <section aria-label="Inventory runway" className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-6 my-6 text-gray-200">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold text-white">Inventory runway & incoming plans</h2><button type="button" onClick={data.refresh} className="underline">Refresh inventory snapshot</button></div>
    <p className="text-sm my-3">{PLANNING_LIMITATIONS}</p>
    <p className="text-sm text-yellow-300">Incoming plans are excluded from available stock. Changes stay in this editor until explicitly saved to shared storage or a browser backup. They never suppress reorder warnings. No purchase orders or notifications are sent.</p>
    <div className="border border-gray-600 rounded p-3 my-4">
      <h3 className="font-bold">Shared planning storage</h3>
      <p role="status" className="my-2">{sharedMessage}</p>
      {revision!==null && JSON.stringify(document())!==sharedSnapshot && <p className="text-yellow-300">Unsaved shared changes in this editor.</p>}
      <p className="text-sm">{revision===null?'No shared version loaded in this editor.':`Editing shared revision ${revision}.`} Save explicitly before leaving; browser backups do not sync.</p>
      <div className="flex flex-wrap gap-4 my-2"><button type="button" className="underline disabled:opacity-50" disabled={busy||uncertain} onClick={fetchShared}>Fetch shared plan</button><button type="button" className="underline disabled:opacity-50" disabled={busy||revision===null} onClick={saveShared}>{uncertain?'Retry previous shared save':'Save shared plan'}</button></div>
      {fetched && <div className="my-3"><p>Fetched revision {fetched.revision} · {fetched.document.lines.length} lines · {fetched.document.days} day window · Lead: {fetched.document.lead||'unset'} · Safety: {fetched.document.safety||'unset'}</p><ul>{fetched.document.lines.map(l=><li key={l.id}>{l.reference} · {l.productId} · {l.quantity} units · {l.etaStart||'unknown'} to {l.etaEnd||'unknown'}</li>)}</ul><button type="button" className="underline mt-2" disabled={busy||uncertain} onClick={useShared}>Replace editor with fetched plan (back up current editor locally)</button></div>}
      <button type="button" className="underline" disabled={busy||uncertain} onClick={()=>{try{const d=JSON.parse(localStorage.getItem('inventory-planning-before-shared'));if(!d||!Array.isArray(d.lines))throw Error();localStorage.setItem('inventory-planning-before-shared',JSON.stringify(document()));setDays(d.days);setLead(d.lead);setSafety(d.safety);setLines(d.lines);setSharedMessage('Recovery backup restored to editor only. Shared data unchanged.')}catch{setSharedMessage('No recovery backup available.')}}}>Restore recovery backup</button>
    </div>
    <fieldset disabled={busy||uncertain}>
    {data.loadedAt && <p className="text-sm my-2">Snapshot: {new Date(data.loadedAt).toISOString()} · refresh after stock or receipt changes.</p>}
    {data.loading && <p role="status">Loading complete inventory snapshot…</p>}
    {(data.error || stale) && <p role="alert" className="text-red-300">{data.error || 'Snapshot is over 15 minutes old. Refresh before using forecasts.'}</p>}
    <div className="grid sm:grid-cols-3 gap-3 my-4">
      <label>Sales window<select aria-label="Sales window" className={field} value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(n=><option key={n} value={n}>{n} completed UTC days</option>)}</select></label>
      <label>Supplier lead time (days)<input className={field} type="number" min="0" max="730" value={lead} onChange={e=>setLead(e.target.value)}/></label>
      <label>Safety cushion (days)<input className={field} type="number" min="0" max="730" value={safety} onChange={e=>setSafety(e.target.value)}/></label>
    </div>
    <p className="text-sm">Enter your planning assumptions (0–730 whole days). They are not supplier guarantees. Reorder point = observed daily units × (lead time + safety cushion), rounded up.</p>
    {ready && <div className="grid lg:grid-cols-2 gap-3 my-4">{data.products.map(product=>{
      const f = forecast({ orders:data.orders, stock:data.inventory.find(r=>String(r.product_id)===String(product.id))?.stock_quantity, productId:product.id, days, leadDays:lead===''?null:Number(lead), safetyDays:safety===''?null:Number(safety) })
      const stock = data.inventory.find(r=>String(r.product_id)===String(product.id))?.stock_quantity
      return <article key={product.id} className="border border-gray-700 rounded p-4 min-w-0"><h3 className="font-bold break-words">{product.name}</h3><p>{Number.isSafeInteger(stock)?stock.toLocaleString():'Unknown'} on hand · {f.units} observed units / {days} days</p><p>Runway: {f.runway===null?'Unknown':`${f.runway.toFixed(1)} days`} · Reorder point: {f.reorderPoint===null?'Not configured':f.reorderPoint.toLocaleString()}</p><p className="text-yellow-300">{f.status}</p><p className="text-sm">{f.start} to {f.end} (end exclusive) · {f.rate.toFixed(2)} units/day</p>{f.lowVolume && <p className="text-sm">Limited history: fewer than 5 eligible orders. Treat the rate cautiously.</p>}{f.invalid>0 && <p className="text-red-300">{f.invalid} malformed sales lines/orders omitted; review before ordering.</p>}{incoming.filter(l=>String(l.productId)===String(product.id)).map((l,i)=><p key={i} className="text-sm mt-2">{l.reference}: {l.remaining??'Unknown'} proposed outstanding · {l.status}. {incomingWarning(f,l)}</p>)}</article>
    })}</div>}
    <h3 className="font-bold mt-5">Proposed incoming shipment lines</h3>
    <p className="text-sm my-2">Use one reference/product line per shipment. Link existing receipts only after verifying they belong to this shipment. Linking subtracts received units from this draft; it never receives stock. Unknown or overdue arrivals must be reconfirmed.</p>
    {lines.map((line,index)=><fieldset key={line.id||index} className="border border-gray-600 p-3 my-3 rounded"><legend>Plan line {index+1}</legend><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <label>Shipment reference<input className={field} value={line.reference} onChange={e=>patch(index,{reference:e.target.value})}/></label>
      <label>Product<select aria-label="Product" className={field} value={line.productId} onChange={e=>patch(index,{productId:e.target.value,receiptIds:[]})}><option value="">Choose product</option>{(data.products||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Ordered units<input className={field} type="number" min="1" step="1" value={line.quantity||''} onChange={e=>patch(index,{quantity:Number(e.target.value)})}/></label>
      <label>Earliest estimated date<input className={field} type="date" value={line.etaStart} onChange={e=>patch(index,{etaStart:e.target.value})}/></label>
      <label>Latest estimated date<input className={field} type="date" value={line.etaEnd} onChange={e=>patch(index,{etaEnd:e.target.value})}/></label>
      <label>Verified matching receipts<select aria-label="Verified matching receipts" multiple className={field} value={line.receiptIds} onChange={e=>patch(index,{receiptIds:Array.from(e.target.selectedOptions,o=>o.value)})}>{(data.receipts||[]).filter(r=>String(r.product_id)===String(line.productId)).map(r=><option key={r.id} value={r.id}>{r.received_at?.slice(0,10)} · {r.quantity} units · {r.id}</option>)}</select></label>
    </div><p className="text-sm mt-2">{incoming[index]?.status} {incoming[index] && `· ${incoming[index].received} linked received · ${incoming[index].remaining??'Unknown'} outstanding`}</p><button type="button" onClick={()=>patch(index,{receiptIds:[]})} className="underline mr-4 mt-3">Clear receipt links</button><button type="button" className="underline mt-3" onClick={()=>setLines(lines.filter((_,i)=>i!==index))}>Remove draft line {index+1}</button></fieldset>)}
    <div className="flex flex-wrap gap-4 mt-4"><button type="button" className="underline" onClick={()=>setLines([...lines,{id:crypto.randomUUID(),reference:'',productId:'',quantity:0,etaStart:'',etaEnd:'',receiptIds:[]}])}>Add incoming draft line</button><button type="button" className="underline" onClick={save}>Save draft on this browser</button><button type="button" className="underline" onClick={load}>Load browser draft</button></div>
    {message && <p role="status" className="my-3">{message}</p>}
    </fieldset>
  </section>
}
export default function InventoryPlanning() { return <InventoryPlanningView data={useInventoryPlanning()}/> }
