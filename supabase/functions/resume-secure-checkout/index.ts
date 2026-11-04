// Only the private capability can recover this buyer's immutable checkout details.
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import {createAdminClient} from '../_shared/pricing.ts'
import {resumeSecurePayment,checkoutErrorMessage} from '../_shared/secureCheckout.js'
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!,{apiVersion:'2023-10-16'})
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store'}
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers})
 try{const text=await req.text();if(text.length>2048)throw Error();const result=await resumeSecurePayment(createAdminClient(),stripe,JSON.parse(text));return Response.json(result.body,{status:result.status,headers})}
 catch(error){return Response.json({error:checkoutErrorMessage(error)},{status:409,headers})}
})
