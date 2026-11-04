import {digest,createEmailRecorder} from './emailHealth.js'
import {referralInvitationOrigin} from './referralInviteOrigin.js'
import {readSupabaseKey} from './supabaseKeys.js'
import {issueBuyerProofOfWork,verifyBuyerProofOfWork,validBuyerChallengeIdentity} from './buyerProofOfWork.js'
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const TOKEN=/^[a-f0-9]{64}$/
const STAGE='https://dmpvmztdkfdkilygxiaj.supabase.co'
const LIVE='https://twrihhyfvomqiqbxkitc.supabase.co'
const STAGE_ORIGIN='https://dsc-referral-stage-20261103.onrender.com'
const fixtureEmails=new Set(['buyer@referral-final.invalid','second-buyer@referral-final.invalid','smoke@referral-final.invalid','owner@referral-final.invalid'])
const generic={message:'Check your email for a verification link. It is valid for one hour. If it does not arrive, check spam or try again shortly.'}
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():''
async function rpc(db,name,args){const result=await db.rpc(name,args);if(result.error)throw Error('Buyer verification is unavailable');return result.data}
export function buyerVerificationContext(env){
 const origin=referralInvitationOrigin(env),project=env.get('SUPABASE_URL'),keyMaterial=readSupabaseKey('secret',env)
 const stage=project===STAGE
 if(!stage&&project!==LIVE)throw Error('Buyer verification project is not approved')
 if(!stage&&(env.get('BUYER_VERIFICATION_APPROVED_TEST_RECIPIENT')||env.get('BUYER_VERIFICATION_TEST_EMAIL_APPROVED')||env.get('BUYER_VERIFICATION_APPROVED_TEST_REQUEST_ID')))throw Error('Test recipient settings cannot be used for live verification')
 // No client or environment test switch may bypass proof of work.
 if(env.get('BUYER_VERIFICATION_TEST_MODE')==='true')throw Error('Mock challenge settings are not supported')
 if(stage&&origin!==STAGE_ORIGIN)throw Error('Buyer verification test settings are not isolated')
 if(!keyMaterial||keyMaterial.length<40)throw Error('Buyer verification signing is not configured')
 return {origin,project,keyMaterial,stage}
}
export async function createBuyerVerificationChallenge(_db,input,env){
 if(env.get('BUYER_EMAIL_VERIFICATION_ENABLED')!=='true'||env.get('BUYER_VERIFICATION_EMAILS_ENABLED')!=='true'||!env.get('RESEND_API_KEY'))return {status:503,body:{error:'Email verification is not available yet. Contact us before continuing.'}}
 const email=normalize(input?.email),id=input?.requestId
 if(!validBuyerChallengeIdentity(email,id))return {status:400,body:{error:'Enter a valid email before completing the verification check.'}}
 const context=buyerVerificationContext(env)
 if(context.stage&&!fixtureEmails.has(email))return {status:409,body:{error:'This isolated test accepts only synthetic fixture email addresses.'}}
 // Stateless issuance grants no email, ownership, reservation or send-budget
 // slot. Never put a shared quota here: an unsolved request could drain it and
 // block every other buyer. Mail budgets are consumed only after valid work.
 return {status:200,body:await issueBuyerProofOfWork(email,id,context)}
}
export const verifyBuyerChallenge=verifyBuyerProofOfWork
export function buyerVerificationEmail(link){
 return `Verify your email for Driveshaft Cable checkout\n\nOpen this private link, then press Verify email: ${link}\n\nThe link expires in one hour. Verification stays in the browser that opens it; it does not give access to whoever requested this email. You can return to your checkout in that browser afterward. No account or password is created.\n\nIf you did not request this email, ignore it. Opening the page alone does not verify anything, place an order or start a payment.\n\nDriveshaft Cable by K.Todd`
}
export async function requestBuyerVerification(db,input,env,{emailTransport=fetch,captureOnly=false,randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')}={}){
 if(env.get('BUYER_EMAIL_VERIFICATION_ENABLED')!=='true'||env.get('BUYER_VERIFICATION_EMAILS_ENABLED')!=='true'||!captureOnly&&!env.get('RESEND_API_KEY'))return {status:503,body:{error:'Email verification is not available yet. Contact us before starting another checkout.'}}
 const email=normalize(input?.email),id=input?.requestId
 if(typeof id!=='string'||!UUID.test(id)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {status:400,body:{error:'Enter a valid email and complete the verification check.'}}
 const context=buyerVerificationContext(env)
 if(captureOnly&&(!context.stage||emailTransport===fetch))throw Error('Verification capture transport is not isolated')
 if(context.stage&&!fixtureEmails.has(email))return {status:409,body:{error:'This isolated test accepts only synthetic fixture email addresses.'}}
 const approvedRecipient=normalize(env.get('BUYER_VERIFICATION_APPROVED_TEST_RECIPIENT'))
 if(context.stage&&!captureOnly&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approvedRecipient)||env.get('BUYER_VERIFICATION_TEST_EMAIL_APPROVED')!=='buyer-verification-v1'||!UUID.test(env.get('BUYER_VERIFICATION_APPROVED_TEST_REQUEST_ID')||'')||id!==env.get('BUYER_VERIFICATION_APPROVED_TEST_REQUEST_ID')||email!=='buyer@referral-final.invalid'))return {status:503,body:{error:'One exact owner-only test recipient, request and message approval are required before staging delivery.'}}
 const challengeHash=await verifyBuyerChallenge(input.challenge,email,id,context)
 if(!challengeHash)return {status:400,body:{error:'The verification check expired or failed. Complete a fresh check and try again.'}}
 const settings=await db.from('referral_settings').select('enabled,buyer_verification_emails_enabled').single()
 if(settings.error||!settings.data?.enabled||!settings.data?.buyer_verification_emails_enabled)return {status:503,body:{error:'Email verification is not available yet. Contact us before starting another checkout.'}}
 const token=randomToken();if(!TOKEN.test(token))throw Error('Verification token unavailable')
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
