// Scheduled weekly. Sends a win-back email to customers whose most-recent
// paid order is 6-9 months old AND who haven't received a win-back in the
// last 6 months.
//
// Uses orders.winback_email_sent_at as the per-order flag. We only consider
// each customer's MOST RECENT order — older orders don't trigger duplicate
// win-backs because we already stamped a newer one. The 6-month exclusion
// window applies to the customer's email, checked across all their orders.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = Deno.env.get('SITE_URL') || 'https://driveshaftcable.com'
const FROM_ADDRESS = 'Driveshaft Cable <orders@k-todd.com>'
const WINBACK_MIN_MONTHS = 6
const WINBACK_MAX_MONTHS = 9
const EXCLUSION_MONTHS = 6
const MAX_PER_RUN = 50

function buildEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
        <tr><td style="background-color:#eab308;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">WE MISS YOU</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Hey ${firstName},</p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
            It's been a while since your last order. Just checking in.
          </p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            Cables are still in stock, still built tough, still shipping fast out of Houston. And as a returning customer, you get an automatic 10% off at checkout.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${SITE_URL}/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
              SHOP AGAIN
            </a>
          </td></tr></table>

          <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;text-align:center;">
            Questions or feedback? Just reply to this email.
          </p>
        </td></tr>
        <tr><td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
          <p style="color:#6b7280;font-size:12px;margin:0;">Driveshaft Cable</p>
          <p style="color:#4b5563;font-size:11px;margin:8px 0 0;">If you'd rather not hear from us, just reply with "unsubscribe".</p>
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

  const now = Date.now()
  const minWindow = new Date(now - WINBACK_MAX_MONTHS * 30 * 24 * 60 * 60 * 1000).toISOString()
  const maxWindow = new Date(now - WINBACK_MIN_MONTHS * 30 * 24 * 60 * 60 * 1000).toISOString()
  const exclusionCutoff = new Date(now - EXCLUSION_MONTHS * 30 * 24 * 60 * 60 * 1000).toISOString()

  // Candidate orders: paid, updated_at between 6 and 9 months ago, no
  // win-back stamped yet. We grab a generous pool and dedupe by email below
  // to one row per customer (their most recent order in the window).
  const { data: candidates, error: fetchErr } = await supabase
    .from('orders')
    .select('id, email, name, updated_at')
    .eq('payment_status', 'paid')
    .not('email', 'is', null)
    .is('winback_email_sent_at', null)
    .gte('updated_at', minWindow)
    .lt('updated_at', maxWindow)
    .order('updated_at', { ascending: false })
    .limit(MAX_PER_RUN * 3)

  if (fetchErr) {
    console.error('Fetch winback candidates failed:', fetchErr)
    return new Response(
      JSON.stringify({ error: 'Fetch failed', details: fetchErr.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  // Dedupe by email — keep only the most recent order per customer.
  const seenEmails = new Set<string>()
  const dedupedOrders = (candidates || []).filter(o => {
    const key = (o.email || '').toLowerCase()
    if (seenEmails.has(key)) return false
    seenEmails.add(key)
    return true
  }).slice(0, MAX_PER_RUN)

  let sent = 0
  let skippedRecentWinback = 0
  let skippedRecentOrder = 0
  let failed = 0

  for (const order of dedupedOrders) {
    const email = (order.email || '').toLowerCase()

    // Exclude if any of this customer's orders received a winback in the
    // last 6 months (don't spam them).
    const { count: recentWinback } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('email', order.email)
      .gte('winback_email_sent_at', exclusionCutoff)

    if ((recentWinback || 0) > 0) {
      await supabase
        .from('orders')
        .update({ winback_email_sent_at: new Date().toISOString() })
        .eq('id', order.id)
      skippedRecentWinback++
      continue
    }

    // Exclude if they've placed a paid order after the candidate window —
    // they're already active, no need to win them back.
    const { count: recentOrder } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('email', order.email)
      .eq('payment_status', 'paid')
      .gte('updated_at', maxWindow)

    if ((recentOrder || 0) > 0) {
      await supabase
        .from('orders')
        .update({ winback_email_sent_at: new Date().toISOString() })
        .eq('id', order.id)
      skippedRecentOrder++
      continue
    }

    const firstName = (order.name || 'Customer').split(' ')[0]
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [order.email],
        subject: `We miss you, ${firstName}`,
        html: buildEmailHtml(firstName),
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
      .update({ winback_email_sent_at: new Date().toISOString() })
      .eq('id', order.id)
    sent++
    await new Promise(r => setTimeout(r, 1000))
  }

  return new Response(
    JSON.stringify({
      sent,
      skipped_recent_winback: skippedRecentWinback,
      skipped_recent_order: skippedRecentOrder,
      failed,
      considered: dedupedOrders.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
