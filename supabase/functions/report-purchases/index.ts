import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { measurementPayload, transmitPurchase } from '../_shared/ga4Outbox.js'

serve(async req => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const workerToken = Deno.env.get('GA4_WORKER_TOKEN')
  if (!serviceKey || !workerToken || req.headers.get('Authorization') !== `Bearer ${workerToken}`) return new Response('Unauthorized', { status: 401 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const secret = Deno.env.get('GA4_API_SECRET')
  // Pause without claiming rows if not configured. Existing rows remain durable.
  if (!secret || Deno.env.get('GA4_DELIVERY_ENABLED') !== 'true') return new Response('Delivery disabled', { status: 503 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
  try {
    const { data, error } = await db.rpc('claim_ga4_purchase')
    if (error) throw error
    const row = data?.[0]
    if (!row) return new Response('No pending purchases')
    const update = async (values: Record<string, unknown>, expected = 'processing') => {
      const result = await db.from('ga4_purchase_outbox').update({ ...values, updated_at: new Date().toISOString() })
        .eq('order_id', row.order_id).eq('claim_token', row.claim_token).eq('state', expected)
        .gt('lease_until', new Date().toISOString()).select('order_id')
      if (result.error || result.data?.length !== 1) throw new Error('claim_lost')
    }
    if (Date.now() - Date.parse(row.paid_at) > 71 * 3600000) {
      await update({ state: 'skipped', reason: 'expired' })
      return new Response('Purchase expired')
    }
    let prepared
    try {
      const intent = await stripe.paymentIntents.retrieve(row.intent_id, { expand: ['latest_charge'] })
      prepared = measurementPayload(intent, row)
    } catch {
      // Safe to retry only before any GA request has begun.
      await update({ state: 'pending', reason: 'stripe_read_failed', available_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.min(row.attempts, 7)) * 1000).toISOString() })
      return new Response('Preflight deferred')
    }
    if (prepared.skip) {
      await update({ state: 'skipped', reason: prepared.skip })
      return new Response('Purchase excluded')
    }
    // Commit send intent before HTTP: concurrent workers cannot both transmit.
    await update({ state: 'sending', lease_until: new Date(Date.now() + 120000).toISOString() })
    const state = await transmitPurchase(prepared.payload, secret)
    await update({ state, reason: state === 'submitted' ? null : 'delivery_review_required' }, 'sending')
    return new Response(state)
  } catch {
    // Never log an upstream error/URL containing the GA secret or Stripe PII.
    return new Response('Analytics worker failed; inspect queue state', { status: 503 })
  }
})
