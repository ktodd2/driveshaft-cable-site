import React, {useEffect,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {supabase} from '../../lib/supabase'
import SuggestionReview from '../../components/admin/SuggestionReview'
export default function AdminSuggestionsPage(){
 const navigate=useNavigate(),[ready,setReady]=useState(false),[error,setError]=useState(false)
 useEffect(()=>{let active=true;supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(error){setError(true);return}if(!data?.session)navigate('/admin/login');else setReady(true)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[navigate])
 if(!ready)return <main className="min-h-screen bg-gray-950 p-8 text-yellow-400">{error?'Session unavailable. Reload to retry.':'Loading…'}</main>
 return <div className="min-h-screen bg-ktodd-dark"><header className="flex justify-between items-center p-4 border-b border-gray-700"><Link to="/admin" className="text-yellow-500 font-industrial flex items-center gap-2"><img src="/logos/icon.png" alt="Driveshaft Cable" className="w-8 h-8 rounded"/>ADMIN</Link><button className="text-gray-300" onClick={async()=>{await supabase.auth.signOut();navigate('/admin/login')}}>Sign Out</button></header><SuggestionReview/></div>
}
