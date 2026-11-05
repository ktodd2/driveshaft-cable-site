// Minimal price quote, including only requested product IDs and priced units.
// Never returns order counts, order IDs, addresses or customer records.
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import {createAdminClient} from '../_shared/pricing.ts'
import {normalizeCheckoutInput} from '../_shared/secureCheckout.js'
import {priceCheckout} from '../_shared/checkoutPricing.ts'
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!,{apiVersion:'2023-10-16'})
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'no-store'}
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers})
 try{
  const text=await req.text();if(text.length>32768)throw Error('Invalid quote')
  const input=normalizeCheckoutInput(JSON.parse(text),{complete:false})
  const quote=await priceCheckout(createAdminClient(),stripe,input,{referralEnabled:Deno.env.get('REFERRAL_REWARDS_ENABLED')==='true',buyerVerificationEnabled:Deno.env.get('BUYER_EMAIL_VERIFICATION_ENABLED')==='true'})
  const linePrices=quote.lines.map(({productId,quantity,unitPrice})=>({productId,quantity,unitPrice}))
  return Response.json({linePrices,subtotalCents:quote.subtotalCents,discountCents:quote.discountCents,shippingCents:quote.shippingCents,taxCents:quote.taxCents,totalCents:quote.totalCents,discountSource:quote.discountSource,repeat:quote.repeat,taxQuoted:!!quote.taxCalculationId,baseDiscountCents:quote.baseDiscountCents,baseDiscountSource:quote.baseDiscountSource,referralDiscountCents:quote.referralDiscountCents,referralDiscountBps:quote.referralDiscountBps,verificationRequired:quote.verificationRequired},{headers})
 }catch(error){const message=error instanceof Error&&error.message.startsWith('This discount makes the order total zero.')?error.message:'Could not verify your order price. Please review the cart and try again.';return Response.json({error:message},{status:409,headers})}
})
