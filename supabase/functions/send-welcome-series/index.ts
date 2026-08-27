// Scheduled every 15 minutes. Sends a 3-email welcome sequence to new
// newsletter subscribers:
//
//   Day 0  — Welcome + brand story + WELCOME5 5%-off code
//   Day 3  — Volume pricing breakdown
//   Day 7  — Customer testimonial + soft CTA
//
// Progress is tracked via newsletter_subscribers.welcome_stage (0 -> 1 -> 2 -> 3).
// Stage 3 = done. Unsubscribed customers are excluded. Only double-opt-in
// confirmed subscribers (confirmed = true) ever enter the series.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = Deno.env.get('SITE_URL') || 'https://driveshaftcable.com'
const FROM_ADDRESS = 'Driveshaft Cable <orders@k-todd.com>'
const MAX_PER_RUN = 50

function emailFooter(): string {
  return `
    <tr>
      <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
        <p style="color:#6b7280;font-size:12px;margin:0;">Driveshaft Cable</p>
        <p style="color:#4b5563;font-size:11px;margin:8px 0 0;">Unsubscribe anytime — just reply with "unsubscribe".</p>
      </td>
    </tr>`
}

function buildDay0Html(firstName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
        <tr><td style="background-color:#eab308;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">WELCOME TO DRIVESHAFT CABLE</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Hey ${firstName},</p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
            Thanks for signing up. We make heavy-duty driveshaft cables — built by an operator who got tired of cheap cables snapping in the field.
          </p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            Here's a 5% off code for your first order, on the house:
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111;border:1px dashed #eab308;margin-bottom:24px;">
            <tr><td style="padding:16px;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;margin:0 0 4px;letter-spacing:1px;">Save 5% with code</p>
              <p style="color:#eab308;font-size:22px;font-weight:bold;font-family:monospace;margin:0;letter-spacing:2px;">WELCOME5</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${SITE_URL}/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
              SHOP NOW
            </a>
          </td></tr></table>
        </td></tr>
        ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildDay3Html(firstName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
        <tr><td style="background-color:#eab308;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">BUY MORE, SAVE MORE</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Hey ${firstName},</p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            If you're stocking the truck or supplying a crew, volume pricing kicks in fast:
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111;border:1px solid #333;margin-bottom:24px;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:14px;border-bottom:1px solid #222;">10-49 units</td>
                  <td style="padding:8px 0;color:#fff;font-size:14px;text-align:right;border-bottom:1px solid #222;">$3.45 each</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:14px;border-bottom:1px solid #222;">50-99 units</td>
                  <td style="padding:8px 0;color:#fff;font-size:14px;text-align:right;border-bottom:1px solid #222;">$3.35 each</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:14px;border-bottom:1px solid #222;">100-199 units</td>
                  <td style="padding:8px 0;color:#fff;font-size:14px;text-align:right;border-bottom:1px solid #222;">$3.15 each</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:14px;">200+ units</td>
                  <td style="padding:8px 0;color:#eab308;font-size:14px;text-align:right;font-weight:bold;">$2.90 each (save 16%)</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            Plus free shipping on orders over $400.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${SITE_URL}/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
              SEE PRICING
            </a>
          </td></tr></table>

          <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;text-align:center;">
            Need a custom quote for a bigger order? <a href="${SITE_URL}/quote" style="color:#eab308;">Request one here.</a>
          </p>
        </td></tr>
        ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildDay7Html(firstName: string, testimonialText: string | null, testimonialName: string | null): string {
  const quoteBlock = testimonialText ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111;border-left:4px solid #eab308;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="color:#d1d5db;font-size:15px;font-style:italic;margin:0 0 8px;line-height:1.5;">"${testimonialText}"</p>
        <p style="color:#eab308;font-size:13px;margin:0;">— ${testimonialName || 'A verified customer'}</p>
      </td></tr>
    </table>` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
        <tr><td style="background-color:#eab308;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">BUILT FOR OPERATORS</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            Hey ${firstName}, one more from us before we leave you alone. Here's what real operators are saying:
          </p>
          ${quoteBlock}
          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            Your WELCOME5 code is still good. If you have any questions, just reply to this email — it goes straight to me.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${SITE_URL}/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
              GRAB YOUR CABLES
            </a>
          </td></tr></table>
        </td></tr>
        ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body></html>`
}

interface Subscriber {
  id: string
  email: string
  welcome_stage: number
  subscribed_at: string
}

async function sendForSubscriber(
  resendApiKey: string,
  sub: Subscriber,
  newStage: number,
  testimonial: { text: string | null; name: string | null }
): Promise<boolean> {
  const firstName = sub.email.split('@')[0].split(/[._-]/)[0]
  let html: string
  let subject: string

  if (sub.welcome_stage === 0) {
    html = buildDay0Html(firstName)
    subject = 'Welcome to Driveshaft Cable — 5% off inside'
  } else if (sub.welcome_stage === 1) {
    html = buildDay3Html(firstName)
    subject = 'How volume pricing works at Driveshaft Cable'
  } else {
    html = buildDay7Html(firstName, testimonial.text, testimonial.name)
    subject = 'One last thing before we leave you alone'
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [sub.email],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`Resend failed for subscriber ${sub.id} (stage ${sub.welcome_stage}): ${errBody}`)
    return false
  }
  return true
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

  const now = Date.now()
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Stage 0 → send immediately, advance to 1
  // Stage 1 → send if subscribed > 3 days ago, advance to 2
  // Stage 2 → send if subscribed > 7 days ago, advance to 3
  const [stage0, stage1, stage2] = await Promise.all([
    supabase.from('newsletter_subscribers')
      .select('id, email, welcome_stage, subscribed_at')
      .eq('status', 'active')
      .eq('confirmed', true)
      .eq('welcome_stage', 0)
      .limit(MAX_PER_RUN),
    supabase.from('newsletter_subscribers')
      .select('id, email, welcome_stage, subscribed_at')
      .eq('status', 'active')
      .eq('confirmed', true)
      .eq('welcome_stage', 1)
      .lt('subscribed_at', threeDaysAgo)
      .limit(MAX_PER_RUN),
    supabase.from('newsletter_subscribers')
      .select('id, email, welcome_stage, subscribed_at')
      .eq('status', 'active')
      .eq('confirmed', true)
      .eq('welcome_stage', 2)
      .lt('subscribed_at', sevenDaysAgo)
      .limit(MAX_PER_RUN),
  ])

  // Pull one approved testimonial to embed in Day 7. If none exists, the
  // email gracefully omits the quote block.
  const { data: testimonialRow } = await supabase
    .from('testimonials')
    .select('testimonial_text, display_name, customer_name')
    .eq('approved', true)
    .eq('status', 'approved')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const testimonial = {
    text: testimonialRow?.testimonial_text || null,
    name: testimonialRow?.display_name || testimonialRow?.customer_name || null,
  }

  const all = [
    ...(stage0.data || []),
    ...(stage1.data || []),
    ...(stage2.data || []),
  ] as Subscriber[]

  let sent = 0
  let failed = 0

  for (const sub of all) {
    const newStage = sub.welcome_stage + 1
    const ok = await sendForSubscriber(resendApiKey, sub, newStage, testimonial)
    if (!ok) {
      failed++
      continue
    }
    const { error: updateErr } = await supabase
      .from('newsletter_subscribers')
      .update({ welcome_stage: newStage })
      .eq('id', sub.id)
    if (updateErr) {
      console.error(`Failed to advance subscriber ${sub.id} to stage ${newStage}:`, updateErr)
      // Don't roll back the email — better to occasionally re-send than to lose track.
    }
    sent++
    await new Promise(r => setTimeout(r, 1000))
  }

  return new Response(
    JSON.stringify({ sent, failed, considered: all.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
