import React,{useEffect,useRef,useState} from 'react'
import {getBuyerVerification,listenForBuyerVerification} from '../../lib/buyerVerification'
const TEST_SITEKEY=/^[123]x0+[ABF]{2}$/
export default function BuyerEmailVerification({email,required,onProof}){
 const [proof,setProof]=useState(()=>getBuyerVerification(email)),[requestId,setRequestId]=useState(()=>crypto.randomUUID()),[challenge,setChallenge]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
 const target=useRef(null),widget=useRef(null)
 const sitekey=import.meta.env.VITE_BUYER_VERIFICATION_SITEKEY||''
 const testAllowed=import.meta.env.VITE_SUPABASE_URL==='https://dmpvmztdkfdkilygxiaj.supabase.co'&&typeof window!=='undefined'&&window.location.hostname==='dsc-referral-stage-20261103.onrender.com'
 const configured=!!sitekey&&(!TEST_SITEKEY.test(sitekey)||testAllowed)
 useEffect(()=>{
  const current=getBuyerVerification(email);setProof(current);onProof(current);setNotice('');setError('');setChallenge('');setRequestId(crypto.randomUUID())
  return listenForBuyerVerification(email,value=>{setProof(value);onProof(value);setNotice('Email verified in this browser.')})
 },[email])
 useEffect(()=>{if(!proof)return;const timer=setTimeout(()=>{setProof(null);onProof(null)},Math.max(0,proof.expiresAt-Date.now()));return()=>clearTimeout(timer)},[proof])
 useEffect(()=>{
  if(!required||proof||!configured||!target.current)return
  let stopped=false
  const render=()=>{if(stopped||!window.turnstile||!target.current)return;widget.current=window.turnstile.render(target.current,{sitekey,action:'buyer-checkout-verification',cData:requestId,callback:token=>setChallenge(token),'expired-callback':()=>setChallenge(''),'error-callback':()=>{setChallenge('');setError('The verification check could not load. Try again or contact us.')}})}
  let script=document.querySelector('script[data-buyer-turnstile]')
  if(window.turnstile)render()
  else{if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.buyerTurnstile='true';document.head.appendChild(script)}script.addEventListener('load',render)}
  return()=>{stopped=true;script?.removeEventListener('load',render);if(widget.current!==null&&window.turnstile){window.turnstile.remove(widget.current);widget.current=null}}
 },[required,proof,configured,requestId])
 async function request(){
  setBusy(true);setError('')
  try{
   const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buyer-email-verification`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action:'request',email,requestId,challenge})})
   const body=await response.json();if(!response.ok)throw Error(body.error||'The verification email could not be requested.')
   setNotice(body.message||'Check your email for a private verification link. Open it and press Verify email.');setChallenge('');setRequestId(crypto.randomUUID())
  }catch(error){setError(error.message||'Verification is unavailable. Try again or contact us.');setChallenge('');setRequestId(crypto.randomUUID())}
  finally{setBusy(false)}
 }
 if(!required)return null
 return <section aria-label="Verify checkout email" className="border border-yellow-600 p-4 my-5 space-y-3"><h2 className="text-white font-bold">Verify your email before your first checkout</h2>{proof?<p role="status" className="text-green-400">Email verified: {proof.email}</p>:<><p>Verify {email} so someone else cannot reserve your first-order checkout. Open the private link and press Verify email; you can then return to this tab.</p>{configured?<div ref={target}/>:<p>Verification is not available yet. Contact us before continuing.</p>}<button type="button" disabled={busy||!challenge||!configured} className="btn-secondary disabled:opacity-50" onClick={request}>{busy?'Requesting…':'Email verification link'}</button></>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="text-red-300">{error}</p>}</section>
}
