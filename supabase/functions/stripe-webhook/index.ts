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

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@example.com'

// Send email notification for new order
async function sendOrderNotification(order: any) {
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email notification')
    return
  }

  try {
    const addr = order.shipping_address
    const shippingAddress = `${order.name}
${order.company ? order.company + '\n' : ''}${addr.address1}
${addr.address2 ? addr.address2 + '\n' : ''}${addr.city}, ${addr.state} ${addr.zip}
${addr.country}`

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1A1A1A; padding: 20px; text-align: center;">
          <h1 style="color: #FFD700; margin: 0;">💰 New Paid Order!</h1>
        </div>

        <div style="background-color: #2D2D2D; padding: 20px; color: #fff;">
          <h2 style="color: #FFD700; border-bottom: 1px solid #444; padding-bottom: 10px;">Order Details</h2>

          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
          <p><strong>Total:</strong> <span style="color: #FFD700; font-size: 1.2em;">$${(order.total_cents / 100).toFixed(2)}</span></p>
          <p><strong>Status:</strong> <span style="color: #22C55E;">PAID ✓</span></p>

          <h3 style="color: #FFD700; margin-top: 20px;">Customer</h3>
          <p>
            ${order.name}<br/>
            ${order.company ? order.company + '<br/>' : ''}
            ${order.email}<br/>
            ${order.phone || 'No phone provided'}
          </p>

          <h3 style="color: #FFD700; margin-top: 20px;">Shipping Address</h3>
          <div style="background-color: #1A1A1A; padding: 15px; border-left: 3px solid #FFD700;">
            <pre style="margin: 0; font-family: Arial, sans-serif; white-space: pre-wrap;">${shippingAddress}</pre>
          </div>

          <h3 style="color: #FFD700; margin-top: 20px;">Items</h3>
          <div style="background-color: #1A1A1A; padding: 15px;">
            ${order.items.map((item: any) => `
              <div style="padding: 8px 0; border-bottom: 1px solid #333;">
                <span>${item.quantity}x ${item.name}</span>
                <span style="float: right; color: #FFD700;">$${(item.price * item.quantity / 100).toFixed(2)}</span>
              </div>
            `).join('')}
            <div style="padding: 12px 0; margin-top: 10px; border-top: 2px solid #FFD700;">
              <strong>Total</strong>
              <strong style="float: right; color: #FFD700;">$${(order.total_cents / 100).toFixed(2)}</strong>
            </div>
          </div>

          <div style="margin-top: 30px; padding: 15px; background-color: #FFD700; text-align: center;">
            <a href="https://driveshaftcable.com/admin/orders" style="color: #000; text-decoration: none; font-weight: bold;">
              View Order in Admin Dashboard →
            </a>
          </div>
        </div>

        <div style="background-color: #1A1A1A; padding: 15px; text-align: center; color: #666; font-size: 12px;">
          Driveshaft Cable by K.Todd
        </div>
      </div>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'K.Todd Orders <orders@driveshaftcable.com>',
        to: [ADMIN_EMAIL],
        subject: `💰 New Order: $${(order.total_cents / 100).toFixed(2)} from ${order.name}`,
        html: emailHtml,
      }),
    })

    if (response.ok) {
      console.log('Order notification email sent successfully')
    } else {
      const error = await response.json()
      console.error('Failed to send notification email:', error)
    }
  } catch (error) {
    console.error('Error sending notification email:', error)
  }
}

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

        // Fetch the full order and send notification
        const { data: order, error: fetchError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()

        if (order && !fetchError) {
          await sendOrderNotification(order)
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
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
