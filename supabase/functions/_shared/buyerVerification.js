import {digest,createEmailRecorder} from './emailHealth.js'
import {referralInvitationOrigin} from './referralInviteOrigin.js'
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const TOKEN=/^[a-f0-9]{64}$/
const STAGE='https://dmpvmztdkfdkilygxiaj.supabase.co'
const LIVE='https://twrihhyfvomqiqbxkitc.supabase.co'
const STAGE_ORIGIN='https://dsc-referral-stage-20261103.onrender.com'
const ACTION='buyer-checkout-verification'
const DUMMY_SECRET=/^[123]x0+AA$/
const DUMMY_KEYS=new Set(['1x0000000000000000000000000000000AA','2x0000000000000000000000000000000AA','3x0000000000000000000000000000000AA'])
const fixtureEmails=new Set(['buyer@referral-final.invalid','second-buyer@referral-final.invalid','smoke@referral-final.invalid','owner@referral-final.invalid'])
const generic={message:'Check your email for a verification link. It is valid for one hour. If it does not arrive, check spam or try again shortly.'}
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():''
async function rpc(db,name,args){const result=await db.rpc(name,args);if(result.error)throw Error('Buyer verification is unavailable');return result.data}
export function buyerVerificationContext(env){
 const origin=referralInvitationOrigin(env),secret=env.get('BUYER_VERIFICATION_CHALLENGE_SECRET')||''
 const test=env.get('BUYER_VERIFICATION_TEST_MODE')==='true'
 const stage=env.get('SUPABASE_URL')===STAGE
 if(!stage&&env.get('SUPABASE_URL')!==LIVE)throw Error('Buyer verification project is not approved')
 if(!stage&&(env.get('BUYER_VERIFICATION_APPROVED_TEST_RECIPIENT')||env.get('BUYER_VERIFICATION_TEST_EMAIL_APPROVED')||env.get('BUYER_VERIFICATION_APPROVED_TEST_REQUEST_ID')))throw Error('Test recipient settings cannot be used for live verification')
 if(test&&(env.get('SUPABASE_URL')!==STAGE||origin!==STAGE_ORIGIN))throw Error('Buyer verification test settings are not isolated')
 if(DUMMY_SECRET.test(secret)&&!test)throw Error('Test challenge keys cannot be used for live verification')
 if(!secret||test&&!DUMMY_KEYS.has(secret))throw Error('Buyer verification challenge is not configured')
 return {origin,secret,test,stage}
}
export async function verifyBuyerChallenge(token,id,context,{transport=fetch,now=Date.now}={}){
 if(typeof token!=='string'||!token||token.length>2048||!UUID.test(id))return false
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000)
 try{
  const response=await transport('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:context.secret,response:token,idempotency_key:id})})
  const result=await response.json()
  if(!response.ok||result.success!==true)return false
  if(context.test){
   // Cloudflare's published sample and current testing-key response differ.
   // Both remain restricted to public dummy tokens on the exact stage context.
   const documented=result.hostname==='localhost'&&result.action==='test'
   const current=result.hostname==='example.com'&&result.action==null&&result.cdata==null&&result.metadata?.result_with_testing_key===true
   return token==='XXXX.DUMMY.TOKEN.XXXX'&&(documented||current)
  }
  const stamp=Date.parse(result.challenge_ts)
  const host=new URL(context.origin).hostname,hosts=host==='driveshaftcable.com'?[host,'www.driveshaftcable.com']:[host]
  return hosts.includes(result.hostname)&&result.action===ACTION&&result.cdata===id&&Number.isFinite(stamp)&&stamp<=now()+30000&&stamp>=now()-300000
 }catch{return false}finally{clearTimeout(timeout)}
}
export function buyerVerificationEmail(link){
 return `Verify your email for Driveshaft Cable checkout\n\nOpen this private link, then press Verify email: ${link}\n\nThe link expires in one hour. Verification stays in the browser that opens it; it does not give access to whoever requested this email. You can return to your checkout in that browser afterward. No account or password is created.\n\nIf you did not request this email, ignore it. Opening the page alone does not verify anything, place an order or start a payment.\n\nDriveshaft Cable by K.Todd`
}
export async function requestBuyerVerification(db,input,env,{challengeTransport=fetch,emailTransport=fetch,captureOnly=false,randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')}={}){
 if(env.get('BUYER_EMAIL_VERIFICATION_ENABLED')!=='true'||env.get('BUYER_VERIFICATION_EMAILS_ENABLED')!=='true'||!captureOnly&&!env.get('RESEND_API_KEY'))return {status:503,body:{error:'Email verification is not available yet. Contact us before starting another checkout.'}}
 const email=normalize(input?.email),id=input?.requestId
 if(typeof id!=='string'||!UUID.test(id)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {status:400,body:{error:'Enter a valid email and complete the verification check.'}}
 const context=buyerVerificationContext(env)
 if(captureOnly&&(!context.stage||emailTransport===fetch))throw Error('Verification capture transport is not isolated')
 if(context.stage&&!fixtureEmails.has(email))return {status:409,body:{error:'This isolated test accepts only synthetic fixture email addresses.'}}
 const approvedRecipient=normalize(env.get('BUYER_VERIFICATION_APPROVED_TEST_RECIPIENT'))
 if(context.stage&&!captureOnly&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approvedRecipient)||env.get('BUYER_VERIFICATION_TEST_EMAIL_APPROVED')!=='buyer-verification-v1'||!UUID.test(env.get('BUYER_VERIFICATION_APPROVED_TEST_REQUEST_ID')||'')||id!==env.get('BUYER_VERIFICATION_APPROVED_TEST_REQUEST_ID')||email!=='buyer@referral-final.invalid'))return {status:503,body:{error:'One exact owner-only test recipient, request and message approval are required before staging delivery.'}}
 const settings=await db.from('referral_settings').select('enabled,buyer_verification_emails_enabled').single()
 if(settings.error||!settings.data?.enabled||!settings.data?.buyer_verification_emails_enabled)return {status:503,body:{error:'Email verification is not available yet. Contact us before starting another checkout.'}}
 if(!await verifyBuyerChallenge(input.challenge,id,context,{transport:challengeTransport}))return {status:400,body:{error:'The verification check expired or failed. Complete a fresh check and try again.'}}
 const token=randomToken();if(!TOKEN.test(token))throw Error('Verification token unavailable')
 // Real challenge tokens cannot be replayed across request IDs. Vendor dummy
 // tokens are constant; only the strictly isolated synthetic branch binds ID too.
 const challengeHash=await digest(context.test?JSON.stringify([id,input.challenge]):input.challenge)
 const accepted=await rpc(db,'buyer_verification_prepare',{p_id:id,p_email:email,p_link_hash:await digest(token),p_challenge_hash:challengeHash})
 if(!accepted)return {status:202,body:generic}
 const recorder=createEmailRecorder(db,captureOnly?'buyer-email-verification-intercepted':'buyer-email-verification',null,emailTransport)
 const link=`${context.origin}/checkout/verify-email#${token}`
 const response=await recorder.send(id,'verification-v1','https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${captureOnly?'intercepted-no-provider-access':env.get('RESEND_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Driveshaft Cable <orders@driveshaftcable.com>',reply_to:'houstontruckwreck@gmail.com',to:context.stage&&!captureOnly?approvedRecipient:email,subject:(context.stage?'[TEST ONLY] ':'')+'Verify your email for Driveshaft Cable checkout',text:(context.stage?`TEST ONLY: simulated verification for ${email}. No real customer or payment.\n\n`:'')+buyerVerificationEmail(link)})})
 const state=await db.from('buyer_verification_requests').update({delivery_state:response.ok?'accepted':'review',delivery_channel:captureOnly?'intercepted':'resend'}).eq('id',id)
 if(state.error)throw Error('Verification delivery requires owner review')
 return {status:202,body:generic}
}
export async function consumeBuyerVerification(db,input,env){
 if(env.get('BUYER_EMAIL_VERIFICATION_ENABLED')!=='true'||typeof input?.token!=='string'||typeof input?.proofToken!=='string'||!TOKEN.test(input.token)||!TOKEN.test(input.proofToken)||input.token===input.proofToken)return {status:400,body:{error:'This verification link is unavailable or expired. Request a new link from checkout.'}}
 const origin=referralInvitationOrigin(env)
 if(env.get('SUPABASE_URL')!==LIVE&&env.get('SUPABASE_URL')!==STAGE||env.get('BUYER_VERIFICATION_TEST_MODE')==='true'&&(env.get('SUPABASE_URL')!==STAGE||origin!==STAGE_ORIGIN))throw Error('Verification settings are not isolated')
 // Only the receiver has this independently generated proof. Never return it
 // to the email requester, in a URL, or through a status/polling endpoint.
 const result=await rpc(db,'buyer_verification_consume',{p_link_hash:await digest(input.token),p_proof_hash:await digest(input.proofToken)})
 return {status:200,body:result}
}
