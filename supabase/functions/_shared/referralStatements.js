import {createEmailRecorder} from './emailHealth.js'
import {rpc,statementText} from './referrals.js'
const AUTOMATION='referral-send-statement', TEMPLATE='statement-v1'
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
// Both manual and automatic paths use this exact claim identity, frozen recipient, body and provider key.
export async function sendReferralStatement(db,id,{enabled=false,apiKey='',transport=fetch,automatic=false}={}) {
 if(!enabled||!apiKey)return {status:409,body:{error:'Referral email delivery is disabled or unavailable'},sent:0,held:0,duplicate:0,disabled:true}
 const {data:settings,error:settingError}=await db.from('referral_settings').select('emails_enabled,auto_statements_enabled,statements_started_at').single()
 if(settingError||!settings?.emails_enabled||(automatic&&(!settings.auto_statements_enabled||!settings.statements_started_at)))return {status:409,body:{error:'Referral email delivery is disabled for review'},sent:0,held:0,duplicate:0,disabled:true}
 const {data:statement,error}=await db.from('referral_statements').select('*').eq('id',id).single()
 if(error||!statement?.recipient_email||!statement.recipient_name||!statement.referral_code)throw Error('Frozen statement unavailable; no send attempted')
 const partner={email:statement.recipient_email,name:statement.recipient_name,code:statement.referral_code}
 const recorder=createEmailRecorder(db,AUTOMATION,null,transport)
 const response=await recorder.send(statement.id,TEMPLATE,'https://api.resend.com/emails',{
  method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
  body:JSON.stringify({from:'Driveshaft Cable <orders@driveshaftcable.com>',reply_to:'houstontruckwreck@gmail.com',to:partner.email,
   subject:`Your ${statement.month} referral balance`,text:statementText(partner,statement)}),
 })
 return {status:response.status,body:await response.json(),sent:recorder.counts.accepted,held:response.ok?0:1,duplicate:recorder.counts.duplicate}
}
export async function runAutomaticStatements(db,{enabled=false,emailEnabled=false,apiKey='',transport=fetch,wait=pause,clock=Date.now,batchSize=50,budgetMs=40000}={}) {
 const counts={considered:0,sent:0,held:0,duplicate:0,prepared:0,review:0,paid:0}
 if(!enabled||!emailEnabled||!apiKey)return {...counts,disabled:true,more:false}
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>50)throw Error('Invalid statement batch size')
 const run=crypto.randomUUID(),started=clock()
 if(!await rpc(db,'referral_claim_statement_run',{p_run:run}))return {...counts,skipped:true,more:false}
 let failed=false,paused=false
 try {
  const prepared=await rpc(db,'referral_prepare_statements',{p_limit:200})
  counts.prepared=prepared.created
  const batch=await rpc(db,'referral_statement_batch',{p_limit:batchSize})
  for(const row of batch.rows) {
   if(clock()-started>=budgetMs)break
   if(counts.considered)await wait(600)
   const result=await sendReferralStatement(db,row.id,{enabled:emailEnabled,apiKey,transport,automatic:true})
   if(result.disabled){paused=true;break}
   counts.considered++;counts.sent+=result.sent;counts.held+=result.held;counts.duplicate+=result.duplicate
  }
  const remaining=await rpc(db,'referral_statement_batch',{p_limit:1})
  counts.review=remaining.held
  failed=counts.held>0||counts.review>0
  return {...counts,paused,month:prepared.month,late:!!prepared.late,more:prepared.remaining>0||remaining.remaining>0,remaining:remaining.remaining,review:remaining.held}
 }catch {failed=true;throw Error('Automatic statement batch requires review; no blind resend')}
 finally {await rpc(db,'referral_finish_statement_run',{p_run:run,p_counts:counts,p_failed:failed})}
}
