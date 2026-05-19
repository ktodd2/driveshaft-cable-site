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
      const taxCalculationId = paymentIntent.metadata.tax_calculation_id

      // Stock decrement is handled by the orders_decrement_stock_trigger
      // database trigger (orders_decrement_stock_trigger.sql), which fires on
      // any UPDATE that flips payment_status to 'paid'. This webhook only
      // needs to ensure that flip happens; the trigger does the rest.
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status, stripe_tax_transaction_id')
        .eq('id', orderId)
        .single()

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
          console.log(`Order ${orderId} payment status set to paid (trigger will decrement stock)`)
        }
      } else {
        console.log(`Order ${orderId} already marked paid, skipping`)
      }

      // Finalize the Stripe Tax calculation into a transaction so this sale
      // shows up in Stripe Tax's filing reports. Calculations alone do NOT
      // appear in reports — only transactions do. Guarded by the existing
      // stripe_tax_transaction_id so webhook re-fires don't double-record.
      if (taxCalculationId && !existingOrder?.stripe_tax_transaction_id) {
        try {
          const transaction = await stripe.tax.transactions.createFromCalculation({
            calculation: taxCalculationId,
            reference: orderId,
          })
          await supabase
            .from('orders')
            .update({ stripe_tax_transaction_id: transaction.id })
            .eq('id', orderId)
          console.log(`Order ${orderId} tax transaction recorded: ${transaction.id}`)
        } catch (taxErr) {
          // Log but do not fail the webhook — the payment succeeded and the
          // tax was already collected. The transaction can be backfilled
          // manually from the Stripe Dashboard if needed.
          console.error(`Order ${orderId} failed to record tax transaction:`, taxErr)
        }
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

    // TODO(refunds): When a refund flow is added, listen for `charge.refunded`
    // or `charge.refund.updated` and call stripe.tax.transactions.createReversal()
    // referencing the original stripe_tax_transaction_id on the order. Without
    // this, refunded sales remain in Stripe Tax reports as if the tax was kept,
    // overstating tax liability at filing time.
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
