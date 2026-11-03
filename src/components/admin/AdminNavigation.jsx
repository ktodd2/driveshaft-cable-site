import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
export const adminDestinations = [['','Dashboard'],['orders','Orders'],['quotes','Quotes'],['suggestions','Suggestions'],['testimonials','Testimonials'],['products','Products'],['sales','Sales'],['referrals','Referral rewards'],['email','Email & health'],['analytics','Analytics'],['newsletter','Newsletter'],['blog','Blog']]
export default function AdminNavigation({ snapshot, client = supabase, badges = {} }) {
 const [count,setCount]=useState(null), [state,setState]=useState('loading')
 const generation=useRef(0)
 useEffect(()=>{
  if(snapshot !== undefined) return
  let active=true
  const refresh=async()=>{const request=++generation.current;setState('loading');try{const {data,error}=await client.rpc('get_suggestion_attention');if(error || !data) throw Error();if(active && request===generation.current){setCount(data.attention);setState('ready')}}catch{if(active && request===generation.current)setState('unavailable')}}
  refresh();window.addEventListener('focus',refresh);window.addEventListener('suggestions-changed',refresh)
  const timer=setInterval(refresh,60000)
  return()=>{active=false;generation.current++;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('suggestions-changed',refresh)}
 },[client,snapshot])
 const value=snapshot !== undefined ? snapshot?.counts.attention : count
 const ready=snapshot !== undefined ? !!snapshot : state==='ready'
 return <nav aria-label="Admin navigation" className="border-b border-gray-700 bg-gray-900 px-4 py-3 flex flex-wrap gap-2">
 {adminDestinations.map(([path,label])=><NavLink aria-label={path==='suggestions'?`Suggestions ${ready?`${value} new`:'count unavailable'}`:label} key={path} end to={`/admin${path?'/'+path:''}`} className={({isActive})=>`px-3 py-2 rounded text-sm ${isActive?'bg-yellow-500 text-black font-bold':'text-gray-200 hover:bg-gray-700'}`}>{label}{badges[path]>0 && <span className="ml-2" title={path==='quotes'?'New quotes in this page snapshot; review conversation before replying.':'Submitted testimonials in this page snapshot; review before publishing.'}>{badges[path]}</span>}{path==='suggestions' && <span title="New suggestions outside manual quarantine. Hints do not remove items from this count; not a count of confirmed spam or unanswered requests." className="ml-2">{ready?`${value} new`:state==='loading' && snapshot===undefined?'…':'count unavailable'}</span>}</NavLink>)}
 <Link to="/" className="px-3 py-2 rounded text-sm text-gray-200 hover:bg-gray-700">View website</Link>
 </nav>
}
