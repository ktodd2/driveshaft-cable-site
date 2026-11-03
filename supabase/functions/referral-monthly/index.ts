// Disabled until a separately approved scheduler calls this endpoint. It never sends mail or pays rewards.
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import {createApiClient} from '../_shared/supabaseTransport.js'
import {getSupabaseSecretKey} from '../_shared/supabaseKeys.js'
import {authorizeStoreRequest} from '../_shared/storeAuthorization.js'
import {rpc} from '../_shared/referrals.js'
serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 if(!await authorizeStoreRequest(req,createClient,{allowCron:true}))return new Response('Unauthorized',{status:403})
 if(Deno.env.get('REFERRAL_REWARDS_ENABLED')!=='true')return new Response('Disabled',{status:409})
 try{const db=createApiClient(createClient,Deno.env.get('SUPABASE_URL'),getSupabaseSecretKey());await rpc(db,'referral_monthly',{});return Response.json({prepared:true,sent:0,paid:0})}
 catch{return new Response('Monthly queue unavailable or outside the 1st in America/Chicago',{status:409})}
})
