import React,{useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import SEOHead from '../components/common/SEOHead'
import {supabase} from '../lib/supabase'
import {pendingBuyerVerification,buyerVerificationAttempt,saveBuyerVerification,clearBuyerVerificationAttempt,announceBuyerVerification,buyerVerificationCanReload} from '../lib/buyerVerification'
export default function BuyerEmailVerificationPage(){
 const [token]=useState(()=>{if(typeof window==='undefined')return '';const value=window.__buyerEmailVerificationToken||window.location.hash.slice(1)||pendingBuyerVerification()?.token||'';if(window.location.hash){if(/^[a-f0-9]{64}$/.test(value))window.__buyerEmailVerificationToken=value;window.history.replaceState(null,'',window.location.pathname)}return value})
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[verified,setVerified]=useState(null),[canReload,setCanReload]=useState(false)
 useEffect(()=>{delete window.__buyerEmailVerificationToken},[])
 async function confirm(){
  setBusy(true);setError('')
  try{
   const attempt=buyerVerificationAttempt(token)
   const {data,error}=await supabase.functions.invoke('buyer-email-verification',{body:{action:'consume',token:attempt.token,proofToken:attempt.proofToken}})
   if(error||data?.error)throw Error('Verification could not be completed. Retry this confirmation or request a new link from checkout.')
   const proof=saveBuyerVerification({...data,token:attempt.proofToken});if(!proof)throw Error('Verification response could not be confirmed.')
   clearBuyerVerificationAttempt();announceBuyerVerification(proof);setCanReload(buyerVerificationCanReload());setVerified(proof.email)
  }catch(error){setError(error.message||'Verification is unavailable. Return to checkout or contact us.')}
  finally{setBusy(false)}
 }
 return <main className="max-w-2xl mx-auto px-4 pt-32 pb-16 text-gray-200 space-y-5"><SEOHead title="Verify your checkout email" description="Private checkout email verification" noindex/><h1 className="font-industrial text-3xl text-white">Verify your email</h1>
 {verified?<><p role="status">Verified {verified} in this browser for one hour.</p><p>Return to your original checkout tab, or continue here. If this is another browser or device, you may need to add your cart and details here. No account was created and no order or payment was placed.</p>{canReload?<a className="btn-primary inline-block" href="/checkout">Continue to checkout</a>:<><p>Keep this tab open while checking out. Your browser has blocked temporary storage.</p><Link className="btn-primary inline-block" to="/checkout">Continue to checkout</Link></>}</>:<><p>Press the button to verify the email this private link was sent to. Opening this page alone verifies nothing and places no order.</p><p className="text-sm text-gray-400">Verification stays in the browser that confirms this link; it is never given to someone else who requested the email. The link expires after one hour. No account or password is created.</p>{error&&<p role="alert" className="text-red-300">{error}</p>}{/^[a-f0-9]{64}$/.test(token)?<button disabled={busy} className="btn-primary" onClick={confirm}>{busy?'Verifying…':'Verify email'}</button>:<p>Open the private link from your email, or request a new link from checkout.</p>}<p><Link to="/checkout" className="underline text-yellow-400">Return to checkout</Link></p></>}
 </main>
}
