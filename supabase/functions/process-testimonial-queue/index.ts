// Process the testimonial-request queue.
//
// Finds paid orders 14+ days old whose owners haven't been asked yet, creates
// a one-time token, emails the customer a magic link, and marks the order as
// requested. Called daily by pg_cron and on-demand by the admin "Send pending
// requests" button.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = Deno.env.get('SITE_URL') || 'https://driveshaftcable.com'
const TOKEN_EXPIRY_DAYS = 60
const MAX_PER_RUN = 50

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function buildEmailHtml(firstName: string, magicUrl: string): string {
  return `<!DOCTYPE html>
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
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">HOW'S IT HOLDING UP?</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
                Hey ${firstName}, it's been a couple weeks since your K.Todd cable shipped.
              </p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
                We'd love to hear how it's working out for you. A quick honest sentence or two would mean a lot.
              </p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
                Click the button below and you'll land on a short form (no login). It takes about 30 seconds.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${magicUrl}" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      LEAVE A TESTIMONIAL
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;line-height:1.5;">
                <strong style="color:#d1d5db;">Heads up:</strong> by submitting your testimonial you grant K.Todd permission to use it in promotional materials (website, social media, marketing emails). You'll get to pick how you want to be credited on the form.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable</p>
              <p style="color:#4b5563;font-size:11px;margin:8px 0 0;">If you're not interested, just ignore this email — we won't send another.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Two callers are allowed:
  //   - pg_cron sends Bearer <service_role_key>
  //   - The admin "Send pending requests" button sends Bearer <user_jwt>
  // Anything else is rejected.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  let authorized = false
  if (token && token === serviceRoleKey) {
    authorized = true
  } else if (token) {
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await userClient.auth.getUser(token)
    if (user) authorized = true
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    )
  }

  // From here on use service-role for the actual DB work.
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: 'Email service not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  // Find eligible orders.
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, email, name, created_at')
    .eq('payment_status', 'paid')
    .not('email', 'is', null)
    .is('testimonial_request_sent_at', null)
    .lt('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .limit(MAX_PER_RUN)

  if (fetchError) {
    console.error('Failed to fetch eligible orders:', fetchError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch orders', details: fetchError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  let sent = 0
  let failed = 0
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  for (const order of orders || []) {
    const token = generateToken()
    const firstName = (order.name || 'Customer').split(' ')[0]
    const magicUrl = `${SITE_URL}/testimonial?token=${token}`

    // Insert pending testimonial row first — if this fails, skip the email.
    const { error: insertError } = await supabase
      .from('testimonials')
      .insert({
        order_id: order.id,
        customer_name: order.name || 'Customer',
        customer_email: order.email,
        token,
        expires_at: expiresAt,
        status: 'pending',
      })

    if (insertError) {
      console.error(`Failed to insert testimonial row for order ${order.id}:`, insertError)
      failed++
      continue
    }

    // Send the email.
    const html = buildEmailHtml(firstName, magicUrl)
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'K.Todd Driveshaft Cable <orders@k-todd.com>',
        to: [order.email],
        subject: `How's your K.Todd cable holding up, ${firstName}?`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error(`Resend failed for order ${order.id}: ${errBody}`)
      // Roll back the pending row so we'll retry next run.
      await supabase.from('testimonials').delete().eq('token', token)
      failed++
      continue
    }

    // Mark the order so we don't ask again.
    const { error: markError } = await supabase
      .from('orders')
      .update({ testimonial_request_sent_at: new Date().toISOString() })
      .eq('id', order.id)

    if (markError) {
      console.error(`Failed to mark order ${order.id} as sent:`, markError)
      // Don't undo the email or token; the next run might re-send, which is
      // mildly annoying but not destructive.
    }

    sent++
    // 1s throttle to stay friendly with Resend's rate limits.
    await new Promise(r => setTimeout(r, 1000))
  }

  return new Response(
    JSON.stringify({ sent, failed, considered: orders?.length || 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
