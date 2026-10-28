// Separate destination: an analytics outage must never delay fulfillment, tax,
// payment state, stock, discount redemption, or customer notifications.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { enqueuePurchase } from '../_shared/ga4Outbox.js'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  let event
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature')!,
      Deno.env.get('STRIPE_ANALYTICS_WEBHOOK_SECRET')!, undefined, cryptoProvider)
  } catch { return new Response('Invalid signature', { status: 400 }) }
  try {
    await enqueuePurchase(db, event)
    return new Response('Received')
  } catch { return new Response('Analytics enqueue unavailable', { status: 503 }) }
})
