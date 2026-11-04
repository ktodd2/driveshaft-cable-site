import React,{useEffect,useRef,useState} from 'react'
import {getBuyerVerification,listenForBuyerVerification} from '../../lib/buyerVerification'

export default function BuyerEmailVerification({email,required,onProof}){
 const [proof,setProof]=useState(()=>getBuyerVerification(email)),[requestId,setRequestId]=useState(()=>crypto.randomUUID()),[challenge,setChallenge]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
 const target=useRef(null),attempt=useRef(null)
 attempt.current={email,requestId}
 const endpoint=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buyer-email-verification`
 const configured=!!import.meta.env.VITE_SUPABASE_URL&&!!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
 useEffect(()=>{
  const current=getBuyerVerification(email);setProof(current);onProof(current);setNotice('');setError('');setChallenge('');setBusy(false);setRequestId(crypto.randomUUID())
  return listenForBuyerVerification(email,value=>{setProof(value);onProof(value);setNotice('Email verified in this browser.')})
 },[email])
 useEffect(()=>{if(!proof)return;const timer=setTimeout(()=>{setProof(null);onProof(null)},Math.max(0,proof.expiresAt-Date.now()));return()=>clearTimeout(timer)},[proof])
 useEffect(()=>{
  if(!required||proof||!configured||!target.current)return
  let stopped=false,widget=null
  const controller=new AbortController()
  const changed=event=>{
   if(stopped)return
   setChallenge(event.detail?.state==='verified'?event.detail.payload||'':'')
   if(event.detail?.state==='error')setError('The verification check could not complete. Retry the check or contact us.')
   else setError('')
  }
  async function mount(){
   // Bundle the pinned widget with the storefront; no third-party script, account,
   // cookies or remote classification service is used for this browser check.
   await import('altcha')
   if(stopped||!target.current)return
   widget=document.createElement('altcha-widget');widget.setAttribute('auto','off');widget.setAttribute('theme','dark')
   widget.addEventListener('statechange',changed);target.current.appendChild(widget)
   // The web component mounts on its connection microtask.
   await Promise.resolve()
   if(stopped)return
   if(typeof widget.configure!=='function')throw Error('Verification could not load')
   await widget.configure({challenge:endpoint,auto:'off',test:false,debug:false,workers:2,timeout:90000,humanInteractionSignature:false,serverVerificationFields:false,serverVerificationTimeZone:false,name:'buyer-email-bot-proof',fetch:async()=>{
    if(stopped)throw Error('Verification was cancelled')
    // Email/UUID are in the POST body, never the request URL or worker data.
    return fetch(endpoint,{method:'POST',signal:controller.signal,credentials:'omit',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action:'challenge',email,requestId})})
   }})
  }
  mount().catch(()=>{if(!stopped){setChallenge('');setError('The verification check could not load. Refresh this page or contact us.');widget?.remove()}})
  return()=>{stopped=true;controller.abort();widget?.removeEventListener('statechange',changed);widget?.reset?.();widget?.remove()}
 },[required,proof,configured,requestId,email,endpoint])
 async function request(){
  const sentEmail=email,sentId=requestId,isCurrent=()=>attempt.current?.email===sentEmail&&attempt.current?.requestId===sentId
  setBusy(true);setError('')
  try{
   const response=await fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action:'request',email:sentEmail,requestId:sentId,challenge})})
   const body=await response.json();if(!isCurrent())return
   if(!response.ok)throw Error(body.error||'The verification email could not be requested.')
   setNotice(body.message||'Check your email for a private verification link. Open it and press Verify email.');setChallenge('');setRequestId(crypto.randomUUID());setBusy(false)
  }catch(error){if(isCurrent()){setError(error.message||'Verification is unavailable. Try again or contact us.');setChallenge('');setRequestId(crypto.randomUUID());setBusy(false)}}
 }
 if(!required)return null
 return <section aria-label="Verify checkout email" className="border border-yellow-600 p-4 my-5 space-y-3"><h2 className="text-white font-bold">Verify your email before your first checkout</h2>{proof?<p role="status" className="text-green-400">Email verified: {proof.email}</p>:<><p>Verify {email} so someone else cannot reserve your first-order checkout. Complete the browser check, request a private link, then open it and press Verify email. You can return to this tab afterward.</p>{configured?<div ref={target}/>:<p>Verification is not available yet. Contact us before continuing.</p>}<button type="button" disabled={busy||!challenge||!configured} className="btn-secondary disabled:opacity-50" onClick={request}>{busy?'Requesting…':'Email verification link'}</button></>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="text-red-300">{error}</p>}</section>
}
