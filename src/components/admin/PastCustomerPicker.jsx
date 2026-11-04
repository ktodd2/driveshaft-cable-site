import React,{useEffect,useId,useRef,useState} from 'react'

export default function PastCustomerPicker({search,onChoose,disabled=false}){
 const id=useId(),listId=id+'-results',version=useRef(0)
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[rows,setRows]=useState([]),[cursor,setCursor]=useState(null)
 const [loading,setLoading]=useState(false),[moreLoading,setMoreLoading]=useState(false),[active,setActive]=useState(-1),[error,setError]=useState('')
 useEffect(()=>{
  if(!open)return
  const current=++version.current
  setLoading(true);setMoreLoading(false);setError('');setRows([]);setCursor(null);setActive(-1)
  const timer=setTimeout(()=>{Promise.resolve().then(()=>search(query,null)).then(result=>{
   if(current!==version.current)return
   setRows(result.customers||[]);setCursor(result.nextCursor||null)
  }).catch(()=>{if(current===version.current)setError('Could not load past customers. Try your search again.')}).finally(()=>{if(current===version.current)setLoading(false)})},200)
  return()=>{clearTimeout(timer);version.current++}
 },[query,open,search])
 useEffect(()=>{if(open&&active>=0)document.getElementById(listId+'-'+active)?.scrollIntoView({block:'nearest'})},[active,open,listId])
 function choose(row){onChoose(row);setQuery(row.email);setOpen(false);setActive(-1)}
 async function more(){
  if(!cursor||loading||moreLoading)return
  const current=version.current;setMoreLoading(true);setError('')
  try{const result=await search(query,cursor);if(current!==version.current)return
   setRows(previous=>[...new Map([...previous,...(result.customers||[])].map(row=>[row.email,row])).values()]);setCursor(result.nextCursor||null)
  }catch{if(current===version.current)setError('Could not load more customers. Try again.')}
  finally{if(current===version.current)setMoreLoading(false)}
 }
 function keys(event){
  if(event.key==='Escape'){setOpen(false);return}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();setOpen(true)
   setActive(previous=>rows.length?Math.max(0,Math.min(rows.length-1,previous+(event.key==='ArrowDown'?1:-1))):-1)
  }else if(event.key==='Enter'&&open){event.preventDefault();if(active>=0&&rows[active])choose(rows[active])}
 }
 return <div className="relative min-w-0 md:col-span-2" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}>
  <label htmlFor={id}>Find a past customer</label>
  <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open&&active>=0&&rows[active]?listId+'-'+active:undefined} aria-describedby={id+'-help'}
   value={query} disabled={disabled} maxLength={254} autoComplete="off" placeholder="Search name or email"
   className="input-field w-full" onFocus={()=>setOpen(true)} onKeyDown={keys} onChange={event=>{onChoose(null);setQuery(event.target.value);setRows([]);setCursor(null);setMoreLoading(false);setActive(-1);setOpen(true)}}/>
  <p id={id+'-help'} className="text-xs text-gray-400 mt-2">Past paid customers, one entry per email. Search or load more; selecting sends nothing.</p>
  {open&&<div className="absolute z-30 w-full bg-gray-900 border border-gray-600 rounded mt-1 shadow-xl">
   <div id={listId} role="listbox" aria-label="Past customers" className="max-h-64 overflow-auto">
    {rows.map((row,index)=><button type="button" role="option" tabIndex={-1} id={listId+'-'+index} key={row.email} aria-selected={active===index} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(row)}
     className={'block text-left w-full px-3 py-3 border-b border-gray-700 break-words '+(active===index?'bg-gray-700':'hover:bg-gray-800')}><span className="block text-white">{row.name||'Name not recorded'}</span><span className="block text-sm text-gray-400 break-all">{row.email}</span></button>)}
   </div>
   <p role="status" aria-live="polite" className="text-sm text-gray-400 p-3">{loading?'Searching past customers…':error||(!rows.length?'No matching past customers.':'Choose a customer above.')}</p>
   {cursor&&<button type="button" disabled={moreLoading||loading} onMouseDown={event=>event.preventDefault()} onClick={more} className="text-yellow-400 underline px-3 pb-3">{moreLoading?'Loading…':'Load more customers'}</button>}
  </div>}
 </div>
}
