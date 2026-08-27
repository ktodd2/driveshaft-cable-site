// Newsletter confirmation endpoint (double opt-in, step 2 of 2).
//
// The confirmation email sent by newsletter-subscribe links to
// /newsletter/confirm?token=..., and that page POSTs the token here. A valid
// token activates the subscriber (confirmed=true, status='active') and starts
// the welcome series from stage 0. subscribed_at is reset so the Day 3 / Day 7
// timing counts from confirmation, not from an old signup row.
//
// Tokens are single-use: they're cleared on success, so a replayed link just
// gets "already confirmed" behavior via the invalid-token path.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let token = ''
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      token = (body.token || '').trim()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }
  } else if (req.method === 'GET') {
    token = new URL(req.url).searchParams.get('token')?.trim() || ''
  } else {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!UUID_RE.test(token)) {
    return json({ error: 'Invalid confirmation link.' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: sub, error: lookupErr } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, confirmed, status')
    .eq('confirmation_token', token)
    .maybeSingle()
  if (lookupErr) {
    console.error('Confirmation lookup failed:', lookupErr)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
  if (!sub) {
    // Unknown or already-used token.
    return json({ error: 'This confirmation link is invalid or has already been used.' }, 404)
  }

  if (sub.confirmed && sub.status === 'active') {
    return json({ success: true, alreadyConfirmed: true })
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('newsletter_subscribers')
    .update({
      confirmed: true,
      confirmed_at: now,
      status: 'active',
      welcome_stage: 0,
      subscribed_at: now,
      unsubscribed_at: null,
      confirmation_token: null,
    })
    .eq('id', sub.id)
  if (updateErr) {
    console.error(`Confirmation update failed for subscriber ${sub.id}:`, updateErr)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }

  return json({ success: true, alreadyConfirmed: false })
})
