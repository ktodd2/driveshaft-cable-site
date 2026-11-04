import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createAdminClient} from '../_shared/pricing.ts'
import {readBoundedJson} from '../_shared/boundedJson.js'
import {createBuyerVerificationChallenge,requestBuyerVerification,consumeBuyerVerification} from '../_shared/buyerVerification.js'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers})
 try{
  const input=await readBoundedJson(req),db=input?.action==='challenge'?null:createAdminClient()
  const result=input.action==='challenge'?await createBuyerVerificationChallenge(db,input,Deno.env):input.action==='request'?await requestBuyerVerification(db,input,Deno.env):input.action==='consume'?await consumeBuyerVerification(db,input,Deno.env):{status:400,body:{error:'Verification action unavailable'}}
  return Response.json(result.body,{status:result.status,headers})
 }catch{return Response.json({error:'Verification could not be completed. Return to checkout or contact us; no order was placed.'},{status:400,headers})}
})
