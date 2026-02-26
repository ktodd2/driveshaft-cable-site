import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getTrackingUrl = (carrier: string, trackingNumber: string) => {
  switch (carrier) {
    case 'ups':
      return `https://www.ups.com/track?tracknum=${trackingNumber}`
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
    default:
      return null
  }
}

const getCarrierName = (carrier: string) => {
  switch (carrier) {
    case 'ups': return 'UPS'
    case 'usps': return 'USPS'
    default: return carrier?.toUpperCase() || 'Carrier'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { customerEmail, customerName, trackingNumber, trackingCarrier, orderId } = await req.json()

    if (!customerEmail || !trackingNumber || !trackingCarrier) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const trackingUrl = getTrackingUrl(trackingCarrier, trackingNumber)
    const carrierName = getCarrierName(trackingCarrier)
    const firstName = customerName?.split(' ')[0] || 'Customer'

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <!-- Header -->
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">YOUR ORDER HAS SHIPPED</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
                Hey ${firstName}, great news! Your order has been shipped via <strong style="color:#fff;">${carrierName}</strong>.
              </p>
              <!-- Tracking Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111;border:1px solid #333;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Carrier</p>
                    <p style="color:#fff;font-size:16px;font-weight:bold;margin:0 0 16px;">${carrierName}</p>
                    <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Tracking Number</p>
                    <p style="color:#eab308;font-size:18px;font-family:monospace;font-weight:bold;margin:0;">${trackingNumber}</p>
                  </td>
                </tr>
              </table>
              <!-- Track Button -->
              ${trackingUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${trackingUrl}" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      TRACK YOUR PACKAGE
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              <p style="color:#6b7280;font-size:13px;margin:24px 0 0;text-align:center;">
                ${orderId ? `Order ID: ${orderId}` : ''}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'K.Todd Driveshaft Cable <orders@k-todd.com>',
        to: [customerEmail],
        subject: `Your order has shipped via ${carrierName}!`,
        html: htmlEmail,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('Resend error:', result)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
