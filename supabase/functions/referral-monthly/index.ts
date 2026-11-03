// Automatic monthly statements. Both send gates default off; never approves or pays rewards.
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import {createApiClient} from '../_shared/supabaseTransport.js'
import {getSupabaseSecretKey} from '../_shared/supabaseKeys.js'
import {authorizeStoreRequest} from '../_shared/storeAuthorization.js'
import {runAutomaticStatements} from '../_shared/referralStatements.js'
import {observeEmailRun} from '../_shared/emailHealth.js'
serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 if(!await authorizeStoreRequest(req,createClient,{allowCron:true}))return new Response('Unauthorized',{status:403})
 if(Deno.env.get('REFERRAL_AUTO_STATEMENTS_ENABLED')!=='true'||Deno.env.get('REFERRAL_EMAILS_ENABLED')!=='true'||!Deno.env.get('RESEND_API_KEY'))return new Response('Automatic statements disabled',{status:409})
 const db=createApiClient(createClient,Deno.env.get('SUPABASE_URL'),getSupabaseSecretKey())
 return await observeEmailRun(db,'referral-monthly',async()=>{
  const result=await runAutomaticStatements(db,{enabled:true,emailEnabled:true,apiKey:Deno.env.get('RESEND_API_KEY')})
  return Response.json({...result,failed:Math.max(result.held,result.review||0)})
 })
})
