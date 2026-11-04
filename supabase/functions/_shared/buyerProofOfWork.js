import {createChallenge,verifySolution} from 'altcha-lib'
import {deriveKey} from 'altcha-lib/algorithms/web/pbkdf2'
import {digest} from './emailHealth.js'

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const HEX32=/^[a-f0-9]{32}$/
const HEX64=/^[a-f0-9]{64}$/
const ACTION='buyer-checkout-email-pow-v1'
const TTL=300
const encoder=new TextEncoder()
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():''
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key))
export function validBuyerChallengeIdentity(email,id){
 return typeof id==='string'&&UUID.test(id)&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
async function signingSecret(context){
 // Derive a purpose/project/origin-specific subkey inside the server. The
 // existing backend key is never transmitted, logged, or used as a challenge.
 const key=await crypto.subtle.importKey('raw',encoder.encode(context.keyMaterial),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const bytes=await crypto.subtle.sign('HMAC',key,encoder.encode(JSON.stringify([ACTION,context.project,context.origin])))
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')
}
export async function issueBuyerProofOfWork(email,id,context,{now=Date.now}={}){
 email=normalize(email)
 if(!validBuyerChallengeIdentity(email,id))throw Error('Invalid challenge request')
 const issuedAt=Math.floor(now()/1000)
 return createChallenge({algorithm:'PBKDF2/SHA-256',cost:5000,keyLength:32,keyPrefix:'00',deriveKey,expiresAt:issuedAt+TTL,hmacSignatureSecret:await signingSecret(context),data:{action:ACTION,requestId:id.toLowerCase(),emailHash:await digest(email),project:context.project,origin:context.origin,issuedAt}})
}
export async function verifyBuyerProofOfWork(payload,email,id,context,{now=Date.now}={}){
 try{
  email=normalize(email)
  if(!validBuyerChallengeIdentity(email,id)||typeof payload!=='string'||payload.length>3072||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))return null
  const decoded=JSON.parse(atob(payload))
  if(!exactKeys(decoded,['challenge','solution'])||!exactKeys(decoded.challenge,['parameters','signature']))return null
  const {challenge,solution}=decoded,p=challenge.parameters,d=p?.data,seconds=Math.floor(now()/1000)
  // Bound all work before calling the library, including authenticated inputs.
  if(!exactKeys(p,['algorithm','nonce','salt','cost','keyLength','keyPrefix','expiresAt','data'])||!exactKeys(d,['action','requestId','emailHash','project','origin','issuedAt']))return null
  if(p.algorithm!=='PBKDF2/SHA-256'||p.cost!==5000||p.keyLength!==32||p.keyPrefix!=='00'||!HEX32.test(p.nonce)||!HEX32.test(p.salt)||!HEX64.test(challenge.signature))return null
  if(!Number.isInteger(d.issuedAt)||d.issuedAt>seconds+30||d.issuedAt<seconds-TTL||p.expiresAt!==d.issuedAt+TTL||p.expiresAt<=seconds)return null
  if(d.action!==ACTION||d.requestId!==id.toLowerCase()||d.emailHash!==await digest(email)||d.project!==context.project||d.origin!==context.origin)return null
  if(!solution||typeof solution!=='object'||Array.isArray(solution)||Object.keys(solution).some(key=>!['counter','derivedKey','time'].includes(key))||!Number.isInteger(solution.counter)||solution.counter<0||solution.counter>0xffffffff||!HEX64.test(solution.derivedKey))return null
  const result=await verifySolution({challenge,solution,deriveKey,hmacSignatureSecret:await signingSecret(context)})
  // Identity is the signed challenge, never its freely variable solution/time
  // or base64/JSON representation. SQL consumes it atomically before sending.
  return result.verified?await digest(`${ACTION}:${challenge.signature}`):null
 }catch{return null}
}
