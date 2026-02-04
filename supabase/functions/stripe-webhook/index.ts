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

      // Update order status
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
        console.log(`Order ${orderId} payment succeeded`)
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
