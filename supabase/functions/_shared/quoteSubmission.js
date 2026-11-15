import {readBoundedJson} from './boundedJson.js'
import {normalizeQuote,quoteRiskReasons,quoteHash,quoteNotification} from './quoteGuard.js'
const headers = {'Access-Control-Allow-Origin':'https://driveshaftcable.com','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'}
const origins = new Set(['https://driveshaftcable.com','https://www.driveshaftcable.com'])
export function createQuoteHandler({env, createDb, fetcher=fetch, secretKey, publishableKey}) { return async req => {
  const origin = req.headers.get('origin')
  const responseHeaders = {...headers,...(origin && origins.has(origin) ? {'Access-Control-Allow-Origin':origin}: {})}
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status,headers:responseHeaders})
  if (origin && !origins.has(origin)) return json({error:'Please use the quote form on driveshaftcable.com.'},403)
  if(req.method==='OPTIONS') return new Response('ok',{headers:responseHeaders})
  if(req.method!=='POST') return json({error:'Method not allowed'},405)
  // Publishable key is gateway compatibility, not bot protection.
  const publishable = publishableKey()
  if(!publishable) return json({error:'Quote service is temporarily unavailable.'},503)
  if(req.headers.get('apikey') !== publishable) return json({error:'Please refresh the quote form and try again.'},401)
  let quote
  try { quote = normalizeQuote(await readBoundedJson(req,{maxBytes:24576})) }
  catch (error) { return json({error: error instanceof Error ? error.message : 'Invalid request'},400) }
  try {
    const secret = secretKey()
    const url = env.get('SUPABASE_URL')
    if(!secret || !url) return json({error:'Quote service is temporarily unavailable. Please contact admin@driveshaftcable.com.'},503)
    const db = createDb(url,secret)
    // Layered abuse signal, not identity proof. Email and global quotas remain
    // effective if upstream proxy header behavior changes or IPs rotate.
    const address = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown').slice(0,128)
    const {request_id,website,started_at,...payload} = quote
    const [requestHash,payloadHash,emailHash,ipHash] = await Promise.all([
      quoteHash(secret,'request',request_id),quoteHash(secret,'payload',JSON.stringify(payload)),quoteHash(secret,'email',quote.email),quoteHash(secret,'ip',address)
    ])
    const {data:saved,error} = await db.rpc('submit_quote_guarded',{p_quote:payload,p_request_hash:requestHash,p_payload_hash:payloadHash,p_email_hash:emailHash,p_ip_hash:ipHash,p_reasons:quoteRiskReasons(quote)})
    if(error) throw Error('Quote storage failed')
    if(saved?.limited) return json({error:'Too many requests. Please wait an hour or email admin@driveshaftcable.com.'},429)
    if(saved?.conflict) return json({error:'This request was already used. Please refresh the page for a new request.'},409)
    if(saved?.notify && saved?.quote_id) {
      // Claim before sending: retries can never create a second notification.
      const {data:claim,error:claimError} = await db.from('quote_submission_guard').update({notification_state:'sending'}).eq('quote_id',saved.quote_id).eq('notification_state','pending').select('quote_id')
      if(!claimError && claim?.length===1) {
        let state='unknown',providerId=null
        try {
          const key=env.get('RESEND_API_KEY')
          if(!key) state='failed'
          else {
            const result=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`quote-request-${saved.quote_id}`},body:JSON.stringify(quoteNotification(payload,saved.quote_id)),signal:AbortSignal.timeout(12000)})
            const body=await result.json()
            state=result.ok && typeof body.id==='string' ? 'sent' : result.status>=400 && result.status<500 ? 'failed':'unknown'
            providerId=state==='sent'?body.id:null
          }
        } catch { /* An uncertain delivery must never be automatically resent. */ }
        const {error:stateError}=await db.from('quote_submission_guard').update({notification_state:state,notification_id:providerId}).eq('quote_id',saved.quote_id).eq('notification_state','sending')
        if(stateError) console.error('quote notification state update failed',saved.quote_id)
      }
    }
    return json({success:true})
  } catch { return json({error:'Your request could not be confirmed. Please retry, or contact admin@driveshaftcable.com.'},503) }
}
}
