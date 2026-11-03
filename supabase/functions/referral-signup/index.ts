import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { getSupabaseSecretKey } from '../_shared/supabaseKeys.js'
import { createApiClient } from '../_shared/supabaseTransport.js'
import { digest } from '../_shared/emailHealth.js'
import { rpc } from '../_shared/referrals.js'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return new Response('Method not allowed',{headers,status:405})
 try{
  if(Deno.env.get('REFERRAL_REWARDS_ENABLED')!=='true')throw Error()
  const body=await req.text();if(body.length>4096)throw Error()
  const {token,name,address,preference,accepted}=JSON.parse(body)
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||accepted!==true)throw Error()
  const db=createApiClient(createClient,Deno.env.get('SUPABASE_URL'),getSupabaseSecretKey())
  const result=await rpc(db,'referral_signup',{p_hash:await digest(token),p_name:name,p_address:address,p_preference:preference})
  return Response.json(result,{headers})
 }catch{return Response.json({error:'Signup could not be completed. Check the required fields or ask the owner for a new invitation.'},{headers,status:400})}
})
