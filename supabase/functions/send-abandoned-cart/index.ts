// Scheduled hourly. Sends an abandoned-cart recovery email to customers who
// entered their email at checkout step 1 but never reached payment.
//
// Skips customers who:
//   - already received the email (email_sent_at set)
//   - placed a paid order after their abandonment (organic recovery)
// Both cases stamp email_sent_at so they're not reconsidered next run.
//
// Single email per abandonment — multi-touch sequences feel spammy at this
// scale and yield diminishing returns.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = Deno.env.get('SITE_URL') || 'https://driveshaftcable.com'
const FROM_ADDRESS = 'Driveshaft Cable <orders@k-todd.com>'
const ABANDONMENT_WAIT_HOURS = 1
const MAX_PER_RUN = 50

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function buildEmailHtml(
  firstName: string,
  items: Array<{ name?: string; quantity: number; price: number }>,
  subtotalCents: number,
  recoveryUrl: string
): string {
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #222;">
        <p style="color:#fff;font-size:15px;margin:0 0 4px;">${item.name || 'Driveshaft Cable'}</p>
        <p style="color:#9ca3af;font-size:13px;margin:0;">Qty: ${item.quantity} × ${formatPrice(item.price)}</p>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #222;text-align:right;vertical-align:top;">
        <p style="color:#fff;font-size:15px;margin:0;">${formatPrice(item.price * item.quantity)}</p>
      </td>
    </tr>`).join('')

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
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">FORGOT SOMETHING?</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
                Hey ${firstName}, looks like you left some Driveshaft Cables in your cart.
              </p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
                No pressure — they're still here when you're ready.
              </p>

              <!-- Cart items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                ${itemRows}
                <tr>
                  <td style="padding:12px 0;">
                    <p style="color:#9ca3af;font-size:13px;margin:0;">Subtotal</p>
                  </td>
                  <td style="padding:12px 0;text-align:right;">
                    <p style="color:#eab308;font-size:18px;font-weight:bold;margin:0;">${formatPrice(subtotalCents)}</p>
                  </td>
                </tr>
              </table>

              <!-- Discount code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111;border:1px dashed #eab308;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;text-align:center;">
                    <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;margin:0 0 4px;letter-spacing:1px;">Save 5% with code</p>
                    <p style="color:#eab308;font-size:22px;font-weight:bold;font-family:monospace;margin:0;letter-spacing:2px;">COMEBACK5</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${recoveryUrl}" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      RETURN TO CART
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:13px;margin:24px 0 0;text-align:center;">
                Your cart will load with everything still in it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">Driveshaft Cable</p>
              <p style="color:#4b5563;font-size:11px;margin:8px 0 0;">If you didn't mean to start a checkout, just ignore this — we won't send another.</p>
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

  // Cron sends the service role key; admin manual trigger sends a user JWT.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  let authorized = token === serviceRoleKey
  if (!authorized && token) {
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

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: 'Email service not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  const cutoff = new Date(Date.now() - ABANDONMENT_WAIT_HOURS * 60 * 60 * 1000).toISOString()

  const { data: abandonments, error: fetchErr } = await supabase
    .from('cart_abandonments')
    .select('id, email, items, subtotal_cents, recovery_token, created_at')
    .is('email_sent_at', null)
    .lt('created_at', cutoff)
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    console.error('Fetch abandonments failed:', fetchErr)
    return new Response(
      JSON.stringify({ error: 'Fetch failed', details: fetchErr.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  let sent = 0
  let skippedRecovered = 0
  let failed = 0

  for (const ab of abandonments || []) {
    // Skip customers who paid after abandonment (organic recovery). Stamp
    // email_sent_at so we don't reconsider them.
    const { count: paidCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('email', ab.email)
      .eq('payment_status', 'paid')
      .gte('created_at', ab.created_at)

    if ((paidCount || 0) > 0) {
      await supabase
        .from('cart_abandonments')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', ab.id)
      skippedRecovered++
      continue
    }

    const firstName = (ab.email || 'there').split('@')[0].split(/[._-]/)[0]
    const items = Array.isArray(ab.items) ? ab.items : []
    const recoveryUrl = `${SITE_URL}/cart/recover/${ab.recovery_token}`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [ab.email],
        subject: 'You left your Driveshaft Cables behind',
        html: buildEmailHtml(firstName, items, ab.subtotal_cents, recoveryUrl),
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error(`Resend failed for abandonment ${ab.id}: ${errBody}`)
      failed++
      continue
    }

    await supabase
      .from('cart_abandonments')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', ab.id)
    sent++

    // Respect Resend rate limits.
    await new Promise(r => setTimeout(r, 1000))
  }

  return new Response(
    JSON.stringify({
      sent,
      skipped_recovered: skippedRecovered,
      failed,
      considered: abandonments?.length || 0,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
