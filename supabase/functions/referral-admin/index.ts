import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { getSupabaseSecretKey, getSupabasePublishableKey } from '../_shared/supabaseKeys.js'
import { createApiClient } from '../_shared/supabaseTransport.js'
import { isActiveAdmin } from '../_shared/storeAuthorization.js'
import { createEmailRecorder, digest } from '../_shared/emailHealth.js'
import {sendReferralStatement} from '../_shared/referralStatements.js'
import { rpc } from '../_shared/referrals.js'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status})
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return json({error:'Method not allowed'},405)
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
 const userClient=createApiClient(createClient,Deno.env.get('SUPABASE_URL'),getSupabasePublishableKey(),{global:{headers:{Authorization:`Bearer ${token}`}}})
 const {data:auth,error}=await userClient.auth.getUser(token)
 if(error||!auth?.user||!await isActiveAdmin(userClient,auth.user.id))return json({error:'Active admin required'},403)
 const db=createApiClient(createClient,Deno.env.get('SUPABASE_URL'),getSupabaseSecretKey())
 try {
  const text=await req.text();if(text.length>8192)return json({error:'Request too large'},400)
  const {action,data={}}=JSON.parse(text)
  const actor=auth.user.id
  if(action==='create'){
   const mode=data.codeMode||'custom'
   if(!['custom','generated'].includes(mode))return json({error:'Choose a custom or generated referral code'},400)
   return json(await rpc(db,'referral_create_partner',{p_actor:actor,p_email:data.email,p_name:data.name,p_code:data.code||null,p_generate:mode==='generated'}))
  }
  if(action==='send-statement'){
   const result=await sendReferralStatement(db,data.id,{enabled:Deno.env.get('REFERRAL_EMAILS_ENABLED')==='true',apiKey:Deno.env.get('RESEND_API_KEY')})
   return json(result.body,result.status)
  }
  if(action==='send-invite'){
   const {data:settings,error}=await db.from('referral_settings').select('*').single()
   if(error||!settings?.emails_enabled||Deno.env.get('REFERRAL_EMAILS_ENABLED')!=='true')return json({error:'Referral email delivery is disabled for review'},409)
   if(!Deno.env.get('RESEND_API_KEY'))return json({error:'Email service unavailable'},503)
   let partner,entity,identity,message,subject
   if(action==='send-invite'){
    const result=await db.from('referral_partners').select('*').eq('id',data.partner_id).single();partner=result.data
    if(result.error||!partner)return json({error:'Partner unavailable'},404)
    const bytes=crypto.getRandomValues(new Uint8Array(32));const secret=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
    const invite=await rpc(db,'referral_admin',{p_actor:actor,p_action:'invite',p_data:{partner_id:partner.id,hash:await digest(secret)}})
    // Token is in the fragment, removed immediately on page load, never in server/access logs.
    const link=`https://driveshaftcable.com/referral/signup#${secret}`
    entity=invite.id;identity='invite-v1';subject='Your Driveshaft Cable referral invitation'
    message=`Hello ${partner.name},\n\nYou have been invited to the Driveshaft Cable referral program. Complete signup within seven days: ${link}\n\nYou will provide your name, mailing address and preferred reward (check or products). No account password or dashboard is created. Rewards and the permanent email-link rules are shown before you accept. This link is for you only.\n\nDriveshaft Cable by K.Todd`
   }
   const recorder=createEmailRecorder(db,'referral-'+action)
   const response=await recorder.send(entity,identity,'https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${Deno.env.get('RESEND_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Driveshaft Cable <orders@driveshaftcable.com>',reply_to:'houstontruckwreck@gmail.com',to:partner.email,subject,text:message})})
   return json(await response.json(),response.status)
  }
  const result=await rpc(db,'referral_admin',{p_actor:actor,p_action:action,p_data:data})
  return json(result)
 }catch(e){return json({error:e instanceof Error?e.message:'Referral action requires review'},409)}
})
