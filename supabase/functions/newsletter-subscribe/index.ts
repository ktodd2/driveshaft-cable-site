// Public newsletter signup endpoint (double opt-in, step 1 of 2).
//
// The site's signup forms call this instead of inserting into
// newsletter_subscribers directly (anonymous inserts are disabled). A new
// signup is stored as status='pending', confirmed=false and receives a
// confirmation email with a tokenized link. Nothing emails a subscriber
// beyond that single confirmation message until they click the link
// (handled by newsletter-confirm), which flips confirmed=true and starts
// the welcome series.
//
// Anti-abuse:
//   - honeypot field ("website"): bots that fill it get a fake success and
//     no database write;
//   - resend throttle: at most one confirmation email per address per
//     RESEND_COOLDOWN_MINUTES;
//   - the response never reveals whether an address was already subscribed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = Deno.env.get('SITE_URL') || 'https://driveshaftcable.com'
const FROM_ADDRESS = 'Driveshaft Cable <orders@k-todd.com>'
const RESEND_COOLDOWN_MINUTES = 10

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function buildConfirmHtml(confirmUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
        <tr><td style="background-color:#eab308;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">CONFIRM YOUR SUBSCRIPTION</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">
            Someone (hopefully you) asked to join the Driveshaft Cable newsletter with this email address.
          </p>
          <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">
            Click the button below to confirm. Until you do, we won't send you anything else.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${confirmUrl}" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
              CONFIRM SUBSCRIPTION
            </a>
          </td></tr></table>
          <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;text-align:center;">
            Didn't sign up? Just ignore this email — you won't hear from us again.
          </p>
        </td></tr>
        <tr>
          <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
            <p style="color:#6b7280;font-size:12px;margin:0;">Driveshaft Cable</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function sendConfirmationEmail(resendApiKey: string, email: string, token: string): Promise<boolean> {
  const confirmUrl = `${SITE_URL}/newsletter/confirm?token=${token}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [email],
      subject: 'Confirm your Driveshaft Cable subscription',
      html: buildConfirmHtml(confirmUrl),
    }),
  })
  if (!res.ok) {
    console.error(`Resend confirmation failed for ${email}: ${await res.text()}`)
    return false
  }
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { email?: string; source?: string; website?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // Honeypot: real users never see this field, so a value means a bot.
  // Pretend it worked and write nothing.
  if (body.website) {
    return json({ success: true })
  }

  const email = (body.email || '').trim().toLowerCase()
  const source = (body.source || 'homepage').slice(0, 50)
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return json({ error: 'Email service not configured' }, 500)
  }

  const { data: existing, error: lookupErr } = await supabase
    .from('newsletter_subscribers')
    .select('id, status, confirmed, confirmation_sent_at')
    .eq('email', email)
    .maybeSingle()
  if (lookupErr) {
    console.error('Subscriber lookup failed:', lookupErr)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }

  // Already a confirmed, active subscriber — nothing to do. Same response as
  // a fresh signup so the endpoint doesn't leak who is subscribed.
  if (existing && existing.confirmed && existing.status === 'active') {
    return json({ success: true })
  }

  // Throttle repeat confirmation emails (double submits, bots re-posting).
  if (existing?.confirmation_sent_at) {
    const elapsedMs = Date.now() - new Date(existing.confirmation_sent_at).getTime()
    if (elapsedMs < RESEND_COOLDOWN_MINUTES * 60 * 1000) {
      return json({ success: true })
    }
  }

  const token = crypto.randomUUID()

  if (existing) {
    const { error: updateErr } = await supabase
      .from('newsletter_subscribers')
      .update({
        status: 'pending',
        confirmed: false,
        confirmation_token: token,
        confirmation_sent_at: new Date().toISOString(),
        source,
      })
      .eq('id', existing.id)
    if (updateErr) {
      console.error('Subscriber update failed:', updateErr)
      return json({ error: 'Something went wrong. Please try again.' }, 500)
    }
  } else {
    const { error: insertErr } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email,
        source,
        status: 'pending',
        confirmed: false,
        confirmation_token: token,
        confirmation_sent_at: new Date().toISOString(),
      })
    if (insertErr) {
      console.error('Subscriber insert failed:', insertErr)
      return json({ error: 'Something went wrong. Please try again.' }, 500)
    }
  }

  const sent = await sendConfirmationEmail(resendApiKey, email, token)
  if (!sent) {
    return json({ error: 'Could not send the confirmation email. Please try again.' }, 502)
  }

  return json({ success: true })
})
