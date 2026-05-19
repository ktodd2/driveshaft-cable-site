// Finalizes a Stripe Tax calculation into a transaction. This is what makes
// the sale show up in Stripe Tax's filing reports — a calculation alone never
// appears in reports.
//
// For website checkout, this finalization happens automatically in the
// stripe-webhook on payment_intent.succeeded. This endpoint exists so that
// admin-created manual orders (cash, Zelle, CashApp) can be recorded in
// Stripe Tax reports too, even though no Stripe payment processed.
//
// Without this endpoint, the merchant's Stripe Tax reports would only reflect
// website sales, not the full picture of taxable sales — leading to
// under-reporting at filing time.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { calculationId, orderId } = await req.json()

    if (!calculationId || !orderId) {
      return new Response(
        JSON.stringify({ error: 'calculationId and orderId are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Idempotency: if the order already has a transaction id, don't double-record.
    const { data: existing } = await adminClient
      .from('orders')
      .select('stripe_tax_transaction_id')
      .eq('id', orderId)
      .single()

    if (existing?.stripe_tax_transaction_id) {
      return new Response(
        JSON.stringify({ transactionId: existing.stripe_tax_transaction_id, alreadyRecorded: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const transaction = await stripe.tax.transactions.createFromCalculation({
      calculation: calculationId,
      reference: orderId,
    })

    await adminClient
      .from('orders')
      .update({ stripe_tax_transaction_id: transaction.id })
      .eq('id', orderId)

    return new Response(
      JSON.stringify({ transactionId: transaction.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('finalize-tax-transaction error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to finalize tax transaction' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
