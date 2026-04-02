import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata.order_id

      // Fetch current order state for idempotency checks
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status, stock_decremented')
        .eq('id', orderId)
        .single()

      // Update payment status if not already paid
      // (client-side code may have set this before the webhook fires)
      if (existingOrder?.payment_status !== 'paid') {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            stripe_payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)

        if (updateError) {
          console.error('Error updating order:', updateError)
        } else {
          console.log(`Order ${orderId} payment status set to paid`)
        }
      } else {
        console.log(`Order ${orderId} already marked paid, skipping status update`)
      }

      // Decrement stock if not already done (separate from payment idempotency)
      if (!existingOrder?.stock_decremented) {
        const itemsJson = paymentIntent.metadata.items
        if (itemsJson) {
          try {
            const items = JSON.parse(itemsJson)
            for (const item of items) {
              const { error: stockError } = await supabase.rpc('decrement_stock', {
                p_product_id: item.productId,
                p_quantity: item.quantity,
              })
              if (stockError) {
                console.error(`Stock decrement failed for product ${item.productId}:`, stockError.message)
              } else {
                console.log(`Decremented ${item.quantity} units for product ${item.productId}`)
              }
            }

            // Mark stock as decremented so duplicate webhooks don't double-decrement
            await supabase
              .from('orders')
              .update({ stock_decremented: true, updated_at: new Date().toISOString() })
              .eq('id', orderId)

            console.log(`Order ${orderId} stock decremented successfully`)
          } catch (parseErr) {
            console.error('Failed to parse items metadata:', parseErr)
          }
        }
      } else {
        console.log(`Order ${orderId} stock already decremented, skipping`)
      }

      break
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata.order_id

      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      console.log(`Order ${orderId} payment failed`)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
