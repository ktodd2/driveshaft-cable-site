import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@example.com'

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
    const { order } = await req.json()

    if (!order) {
      throw new Error('Order data is required')
    }

    // Format the order items
    const itemsList = order.items
      .map((item: any) => `• ${item.quantity}x ${item.name} - $${(item.price * item.quantity / 100).toFixed(2)}`)
      .join('\n')

    // Format the shipping address
    const addr = order.shipping_address
    const shippingAddress = `${order.name}
${order.company ? order.company + '\n' : ''}${addr.address1}
${addr.address2 ? addr.address2 + '\n' : ''}${addr.city}, ${addr.state} ${addr.zip}
${addr.country}`

    // Create email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1A1A1A; padding: 20px; text-align: center;">
          <h1 style="color: #FFD700; margin: 0;">New Order Received!</h1>
        </div>

        <div style="background-color: #2D2D2D; padding: 20px; color: #fff;">
          <h2 style="color: #FFD700; border-bottom: 1px solid #444; padding-bottom: 10px;">Order Details</h2>

          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
          <p><strong>Total:</strong> <span style="color: #FFD700; font-size: 1.2em;">$${(order.total_cents / 100).toFixed(2)}</span></p>

          <h3 style="color: #FFD700; margin-top: 20px;">Customer</h3>
          <p>
            ${order.name}<br/>
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
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333;">
                <span>${item.quantity}x ${item.name}</span>
                <span style="color: #FFD700;">$${(item.price * item.quantity / 100).toFixed(2)}</span>
              </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 10px; border-top: 2px solid #FFD700;">
              <strong>Total</strong>
              <strong style="color: #FFD700;">$${(order.total_cents / 100).toFixed(2)}</strong>
            </div>
          </div>

          <div style="margin-top: 30px; padding: 15px; background-color: #FFD700; color: #000; text-align: center;">
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

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'K.Todd Orders <orders@driveshaftcable.com>',
        to: [ADMIN_EMAIL],
        subject: `🛒 New Order: $${(order.total_cents / 100).toFixed(2)} from ${order.name}`,
        html: emailHtml,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Failed to send email')
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error sending notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
