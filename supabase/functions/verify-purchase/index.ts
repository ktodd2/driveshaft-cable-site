// Read-only verification for the browser confirmation page. No DB mutations,
// fulfillment, GA Measurement Protocol calls, or customer data in the response.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { verifiedPurchaseResponse } from '../_shared/purchaseAnalytics.js'

// Keep the API/SDK version aligned with this site's existing payment functions.
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, { apiVersion: '2023-10-16' })
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers, status })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = await req.text()
    if (body.length > 2048) return json({ error: 'Invalid confirmation request' }, 400)
    const { orderId, clientSecret } = JSON.parse(body)
    if (typeof orderId !== 'string' || !/^[a-f0-9-]{36}$/i.test(orderId) ||
      typeof clientSecret !== 'string' || !/^pi_[a-zA-Z0-9]+_secret_[a-zA-Z0-9]+$/.test(clientSecret)) {
      return json({ error: 'Invalid confirmation request' }, 400)
    }
    const intentId = clientSecret.split('_secret_')[0]
    const intent = await stripe.paymentIntents.retrieve(intentId)
    const result = verifiedPurchaseResponse(intent, orderId, clientSecret)
    if (!result) return json({ error: 'Unable to verify this payment' }, 403)
    return json(result)
  } catch {
    // Never log/echo the request, secret, Stripe object, or upstream error.
    return json({ error: 'Payment confirmation is temporarily unavailable' }, 503)
  }
})
