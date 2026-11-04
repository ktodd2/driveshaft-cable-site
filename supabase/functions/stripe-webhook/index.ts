import {handleReferralEvent} from '../_shared/referrals.js'
import {createApiClient} from '../_shared/supabaseTransport.js'
import {getSupabaseSecretKey} from '../_shared/supabaseKeys.js'
import {reconcileOrderPayment} from '../_shared/secureCheckout.js'
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0'
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!,{apiVersion:'2023-10-16'})
const db=createApiClient(createClient,Deno.env.get('SUPABASE_URL')!,getSupabaseSecretKey()!)
serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 let event
 try{event=await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get('stripe-signature')!,Deno.env.get('STRIPE_WEBHOOK_SECRET')!,undefined,Stripe.createSubtleCryptoProvider())}
 catch{return new Response('Invalid signature',{status:400})}
 // Test endpoints/keys must never change production orders, stock or rewards.
 // Verify the signature first, then ignore non-live events before any API/DB work.
 if(event.livemode!==true)return Response.json({received:true,ignored:true})
 try{
  // Fresh authoritative state prevents a stale failure from undoing a successful payment.
  if(['payment_intent.succeeded','payment_intent.payment_failed'].includes(event.type)){
   const intent=await stripe.paymentIntents.retrieve(event.data.object.id,{expand:['latest_charge']})
   await reconcileOrderPayment(db,stripe,intent,{failed:event.type==='payment_intent.payment_failed'&&intent.status!=='succeeded'})
  }
  // Reward failure remains retryable after secure stock/payment reconciliation has completed.
  await handleReferralEvent(db,stripe,event)
  return Response.json({received:true})
 }catch{return new Response('Payment reconciliation unavailable; retry required',{status:503})}
 // Refund tax reversal remains a separate existing workflow; this repair does not issue refunds.
})
