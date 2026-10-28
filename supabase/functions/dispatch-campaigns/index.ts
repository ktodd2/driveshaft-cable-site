import { isActiveAdmin } from '../_shared/storeAuthorization.js'
import { createApiClient } from '../_shared/supabaseTransport.js'
import { getSupabaseSecretKey, getSupabasePublishableKey, hasBackendApiKey } from '../_shared/supabaseKeys.js'
// Scheduled campaign dispatcher.
//
// This is the piece that was missing from version control. The admin panel
// could create 'scheduled' and 'recurring' campaigns with a next_send_at, but
// nothing in the repo ever polled for them — so the job that actually fired
// them existed only as an ad-hoc pg_cron entry in the live database, invisible
// to code review. It ran every 15 minutes, which is what produced the flood.
//
// Runs hourly. Finds campaigns that are genuinely due and hands each to
// send-marketing-email, which claims it before sending. Being called twice is
// harmless: the second call loses the claim race and no-ops.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_CAMPAIGNS_PER_RUN = 5

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = getSupabaseSecretKey()!
  const cronTriggerKey = Deno.env.get('CRON_TRIGGER_KEY') || ''
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

  let authorized = hasBackendApiKey(req, serviceRoleKey) || (!!cronTriggerKey && token === cronTriggerKey)
  if (!authorized && token) {
    const userClient = createApiClient(createClient, supabaseUrl, getSupabasePublishableKey()!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (!authError && user) authorized = await isActiveAdmin(userClient, user.id)
  }
  if (!authorized) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createApiClient(createClient, supabaseUrl, serviceRoleKey)

  const { data: due, error } = await supabase
    .from('email_campaigns')
    .select('id, subject, send_type, next_send_at')
    .eq('is_active', true)
    .in('status', ['scheduled', 'active'])
    .not('next_send_at', 'is', null)
    .lte('next_send_at', new Date().toISOString())
    .order('next_send_at', { ascending: true })
    .limit(MAX_CAMPAIGNS_PER_RUN)

  if (error) {
    console.error('Fetch due campaigns failed:', error)
    return json({ error: 'Fetch failed', details: error.message }, 500)
  }

  const results: Array<Record<string, unknown>> = []

  for (const campaign of due || []) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-marketing-email`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId: campaign.id }),
      })
      results.push({
        campaignId: campaign.id,
        subject: campaign.subject,
        status: res.status,
        body: await res.json().catch(() => null),
      })
    } catch (err) {
      console.error(`Dispatch failed for campaign ${campaign.id}:`, err)
      results.push({ campaignId: campaign.id, error: (err as Error).message })
    }
  }

  return json({ dispatched: results.length, results })
})
