import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Sent the moment the auto-tracking cron detects a package has been delivered.
// Separate from the 14-day testimonial request (process-testimonial-queue) so
// the customer gets an immediate "it arrived" confirmation without being asked
// to write a review yet.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { customerEmail, customerName, orderId } = await req.json()

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing customerEmail' }),
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

    const firstName = customerName?.split(' ')[0] || 'Customer'
    const siteOrigin = Deno.env.get('SITE_ORIGIN') || 'https://driveshaftcable.com'
    const reviewUrl = orderId
      ? `${siteOrigin}/testimonial?order=${encodeURIComponent(orderId)}`
      : `${siteOrigin}/testimonial`

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
            <td style="background-color:#22c55e;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">YOUR ORDER HAS ARRIVED</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
                Hey ${firstName},
              </p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
                Your Driveshaft Cable order just got marked as delivered by the carrier. Hope it landed safely — give it a once-over and let us know if anything looks off.
              </p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
                Once you've put it to work in the field, we'd really appreciate a quick note about how it held up:
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${reviewUrl}" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      LEAVE QUICK FEEDBACK
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#6b7280;font-size:13px;margin:24px 0 0;text-align:center;">
                ${orderId ? `Order ID: ${orderId}` : ''}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">Driveshaft Cable — Made by a heavy-duty operator for the heavy-duty operator</p>
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
        from: 'Driveshaft Cable <orders@k-todd.com>',
        to: [customerEmail],
        subject: 'Your Driveshaft Cable order has arrived!',
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
    console.error('send-delivery-email error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
