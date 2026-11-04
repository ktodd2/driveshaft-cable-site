import React,{useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {supabase} from '../../lib/supabase'
import ReferralRewards from '../../components/admin/ReferralRewards'
export default function AdminReferralsPage(){
 const navigate=useNavigate(),[ready,setReady]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;supabase.auth.getUser().then(async({data,error})=>{if(!active)return;if(error||!data?.user){navigate('/admin/login');return}const result=await supabase.from('admin_users').select('id').eq('id',data.user.id).eq('is_active',true).maybeSingle();if(!active)return;if(result.error||!result.data)setError('Active admin access required');else setReady(true)}).catch(()=>{if(active)setError('Session unavailable')});return()=>{active=false}},[navigate])
 return <div className="min-h-screen bg-ktodd-dark">{ready?<ReferralRewards/>:<p role="status" className="p-8 text-white">{error||'Checking admin access…'}</p>}</div>
}
