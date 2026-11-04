// The browser supplies cart/customer fields and a private retry capability, never an existing order to mutate.
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import {createAdminClient} from '../_shared/pricing.ts'
import {createSecurePayment,checkoutErrorMessage} from '../_shared/secureCheckout.js'
import {priceCheckout} from '../_shared/checkoutPricing.ts'
import {createPurchaseSnapshot} from '../_shared/purchaseAnalytics.js'
import {analyticsMetadata} from '../_shared/ga4Outbox.js'
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!,{apiVersion:'2023-10-16'})
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store'}
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers})
 try{
  const text=await req.text();if(text.length>32768)throw Error('Invalid checkout')
  const input=JSON.parse(text)
  if(input.orderId)return Response.json({error:'Checkout has been updated. Refresh before continuing; do not repay an existing payment.'},{status:409,headers})
  const db=createAdminClient()
  const result=await createSecurePayment(db,stripe,input,(normalized:any)=>priceCheckout(db,stripe,normalized,{failTaxOpen:true,referralEnabled:Deno.env.get('REFERRAL_REWARDS_ENABLED')==='true',buyerVerificationEnabled:Deno.env.get('BUYER_EMAIL_VERIFICATION_ENABLED')==='true'}),{
   referralEnabled:Deno.env.get('REFERRAL_REWARDS_ENABLED')==='true',
   analyticsMetadata:(analytics:any)=>analyticsMetadata(analytics,Deno.env.get('GA4_SERVER_PURCHASES_ENABLED')==='true'),
   purchaseSnapshot:(p:any)=>createPurchaseSnapshot(p.lines.map((line:any)=>({...line,analyticsName:line.name})),p.subtotalCents,p.discountCents,p.shippingCents,p.taxCents),
  })
  return Response.json(result.body,{status:result.status,headers})
 }catch(error){const message=checkoutErrorMessage(error);return Response.json({error:message,...(message.startsWith('Email verification required')?{verificationRequired:true}:{})},{status:409,headers})}
})
