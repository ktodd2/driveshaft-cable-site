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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { amount, orderId, customerEmail, items, taxCalculationId } = await req.json()

    // Validate stock for each item before creating payment
    if (items && items.length > 0) {
      for (const item of items) {
        const { data: inventory, error: invError } = await adminClient
          .from('product_inventory')
          .select('stock_quantity')
          .eq('product_id', item.productId)
          .single()

        if (invError || !inventory) {
          return new Response(
            JSON.stringify({ error: `Product not found: ${item.productId}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        if (inventory.stock_quantity < item.quantity) {
          return new Response(
            JSON.stringify({
              error: `Insufficient stock. Only ${inventory.stock_quantity} units available.`,
              availableStock: inventory.stock_quantity
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
      }
    }

    // tax_cents and stripe_tax_calculation_id were already persisted to the
    // order row by the INSERT in CheckoutPage.handleShippingSubmit, using the
    // amounts returned by calculate-tax (server-trusted prices). The webhook
    // calls stripe.tax.transactions.createFromCalculation(taxCalculationId)
    // on payment_intent.succeeded, which is what produces the authoritative
    // tax transaction for filing reports.

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents — already includes server-calculated tax from the client side
      currency: 'usd',
      metadata: {
        order_id: orderId,
        items: items ? JSON.stringify(items) : '[]',
        // Stored so the webhook can call stripe.tax.transactions.createFromCalculation
        // after payment succeeds. Without this metadata, the calculation never
        // becomes a reportable tax transaction in Stripe's reports.
        tax_calculation_id: taxCalculationId || '',
      },
      receipt_email: customerEmail,
    })

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
