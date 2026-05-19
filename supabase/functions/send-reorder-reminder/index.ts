// Scheduled daily. Sends a one-time reorder reminder to customers 30 days
// after their order was marked paid. Stamps reorder_reminder_sent_at so the
// same order is never reminded twice.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = Deno.env.get('SITE_URL') || 'https://driveshaftcable.com'
const FROM_ADDRESS = 'Driveshaft Cable <orders@k-todd.com>'
const REORDER_DAYS = 30
const MAX_PER_RUN = 50

interface OrderItem {
  productId?: string
  name?: string
  quantity?: number
  price?: number
}

function buildEmailHtml(firstName: string, items: OrderItem[]): string {
  const lastQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const reorderUrl = `${SITE_URL}/products`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
        <tr><td style="background-color:#eab308;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">TIME TO RESTOCK?</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Hey ${firstName},</p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
            It's been about a month since your last order. Running low?
          </p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            You ordered <strong style="color:#eab308;">${lastQty} cables</strong> last time — same again, or a different quantity, takes 30 seconds.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${reorderUrl}" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
              REORDER NOW
            </a>
          </td></tr></table>

          <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;text-align:center;">
            Returning customers automatically get 10% off at checkout.
          </p>
        </td></tr>
        <tr><td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
          <p style="color:#6b7280;font-size:12px;margin:0;">Driveshaft Cable</p>
          <p style="color:#4b5563;font-size:11px;margin:8px 0 0;">Not ready? No worries — we won't keep nagging.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  const cronTriggerKey = Deno.env.get('CRON_TRIGGER_KEY') || ''
  let authorized = token === serviceRoleKey || (cronTriggerKey && token === cronTriggerKey)
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

  const cutoff = new Date(Date.now() - REORDER_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, email, name, items, updated_at')
    .eq('payment_status', 'paid')
    .not('email', 'is', null)
    .is('reorder_reminder_sent_at', null)
    .lt('updated_at', cutoff)
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    console.error('Fetch reorder candidates failed:', fetchErr)
    return new Response(
      JSON.stringify({ error: 'Fetch failed', details: fetchErr.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  let sent = 0
  let failed = 0

  for (const order of orders || []) {
    const firstName = (order.name || 'Customer').split(' ')[0]
    const items = Array.isArray(order.items) ? order.items : []

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [order.email],
        subject: `Time to restock, ${firstName}?`,
        html: buildEmailHtml(firstName, items),
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error(`Resend failed for order ${order.id}: ${errBody}`)
      failed++
      continue
    }

    await supabase
      .from('orders')
      .update({ reorder_reminder_sent_at: new Date().toISOString() })
      .eq('id', order.id)
    sent++
    await new Promise(r => setTimeout(r, 1000))
  }

  return new Response(
    JSON.stringify({ sent, failed, considered: orders?.length || 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
