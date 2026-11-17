// Retired program. Historical records and payment reconciliation are retained.
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store'}
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 return Response.json({error:'The referral program has ended.'},{status:410,headers})
})
