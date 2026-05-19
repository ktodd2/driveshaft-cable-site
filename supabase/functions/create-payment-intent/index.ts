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

    // If the checkout produced a tax calculation, re-retrieve it server-side
    // to verify it exists and isn't expired. Tax calculations live for 48h.
    // The retrieved tax_amount_exclusive is the authoritative tax that the
    // webhook will turn into a tax transaction after payment succeeds.
    let serverTaxCents = 0
    if (taxCalculationId) {
      try {
        const calculation = await stripe.tax.calculations.retrieve(taxCalculationId)
        serverTaxCents = calculation.tax_amount_exclusive

        // Persist the tax amount and calculation id to the order row now so
        // that even if the webhook fires before the success page redirect,
        // the order has the authoritative tax already recorded.
        await adminClient
          .from('orders')
          .update({
            tax_cents: serverTaxCents,
            stripe_tax_calculation_id: taxCalculationId,
          })
          .eq('id', orderId)
      } catch (taxError) {
        // The calculation expired or doesn't exist. Block checkout rather
        // than silently charging without tax.
        return new Response(
          JSON.stringify({
            error: 'Tax calculation expired. Please review your address and try again.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

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
