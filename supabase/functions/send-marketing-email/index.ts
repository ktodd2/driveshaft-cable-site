import { isActiveAdmin } from '../_shared/storeAuthorization.js'
import { createApiClient } from '../_shared/supabaseTransport.js'
import { getSupabaseSecretKey, getSupabasePublishableKey, hasBackendApiKey } from '../_shared/supabaseKeys.js'
import { loadMarketingAudience, loadProviderMarketingExclusions, sendMarketingRecipients } from '../_shared/marketingEmail.js'
// Marketing campaign sender.
//
// Previously this function would re-blast the entire customer list on every
// invocation: it had no auth check, sent unconditionally without looking at
// campaign state, and only wrote "this campaign is finished" AFTER a loop that
// slept 1 second per recipient. Any run killed by the execution limit never
// reached that write, so the campaign stayed due and the next trigger started
// the whole blast over. Result: the same email every 15 minutes to everyone.
//
// Now:
//   * Requires auth — service role, cron key, or a signed-in admin.
//   * Claims the campaign under a lease, so overlapping triggers no-op.
//   * Logs every recipient and skips already-mailed addresses, so a run that
//     dies mid-list resumes instead of re-sending.
//   * Checks global opt-outs and provider exclusions before any campaign write.
//   * Records individual provider IDs under stable recipient idempotency keys.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEASE_SECONDS = 900       // how long a claim is held before it's reclaimable

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

async function fetchAlreadySent(
  client: any,
  campaignId: number,
  cycle: number
): Promise<Set<string>> {
  const seen = new Set<string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('email_campaign_recipients')
      .select('email')
      .eq('campaign_id', campaignId)
      .eq('cycle', cycle)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`recipients: ${error.message}`)
    if (!data?.length) break
    for (const row of data) seen.add(row.email)
    if (data.length < PAGE) break
  }
  return seen
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = getSupabaseSecretKey()!
  const cronTriggerKey = Deno.env.get('CRON_TRIGGER_KEY') || ''
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

  // Auth guard. This function can mail every customer on file — it must never
  // be callable by anyone who simply knows the URL.
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

  const adminClient = createApiClient(createClient, supabaseUrl, serviceRoleKey)

  // Tracked outside the try so the error path can drop a lease we already took.
  let claimedCampaignId: number | null = null

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return json({ error: 'Email service not configured' }, 500)
    }

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !['send', 'preview'].includes(body.action || 'send') ||
        ['testEmail', 'recipients', 'dryRun'].some(key => key in body)) {
      return json({ error: 'Use action preview for read-only eligibility checks, or send with subject/htmlContent or campaignId' }, 400)
    }

    // Fail closed before creating/claiming a campaign if either exclusion source
    // is unavailable. Preview uses this exact audience and never writes state.
    const providerExcluded = await loadProviderMarketingExclusions(resendApiKey)
    const audience = await loadMarketingAudience(adminClient, providerExcluded)
    const eligibility = { total: audience.total, candidates: audience.candidates,
      excludedOptOut: audience.excludedOptOut, excludedProvider: audience.excludedProvider }
    if (body.action === 'preview') return json({ success: true, preview: true, ...eligibility })

    // -----------------------------------------------------------------------
    // Resolve the campaign. Manual sends create the row up front (rather than
    // after the loop, as before) so they get the same claim + resume safety.
    // -----------------------------------------------------------------------
    let campaignId: number
    let requireDue: boolean

    if (body.campaignId) {
      campaignId = Number(body.campaignId)
      if (!Number.isSafeInteger(campaignId) || campaignId <= 0) return json({ error: 'Invalid campaignId' }, 400)
      requireDue = body.force !== true
    } else if (body.subject && body.htmlContent) {
      const { data: created, error: createErr } = await adminClient
        .from('email_campaigns')
        .insert({
          subject: body.subject,
          html_content: body.htmlContent,
          send_type: 'immediate',
          status: 'active',
          is_active: false,
        })
        .select('id')
        .single()
      if (createErr || !created) {
        return json({ error: `Could not create campaign: ${createErr?.message}` }, 500)
      }
      campaignId = created.id
      requireDue = false
    } else {
      return json(
        { error: 'Provide either { subject, htmlContent } or { campaignId }' },
        400
      )
    }

    // -----------------------------------------------------------------------
    // Claim it. If another run already holds the lease, stop here — this is
    // what turns a duplicate trigger into a no-op instead of a second blast.
    // -----------------------------------------------------------------------
    const { data: claimRows, error: claimErr } = await adminClient.rpc(
      'claim_campaign_for_send',
      {
        p_campaign_id: campaignId,
        p_lease_seconds: LEASE_SECONDS,
        p_require_due: requireDue,
      }
    )
    if (claimErr) {
      return json({ error: `Claim failed: ${claimErr.message}` }, 500)
    }

    const campaign = Array.isArray(claimRows) ? claimRows[0] : claimRows
    if (!campaign) {
      // Not due, already finished/cancelled, or another run holds the lease.
      return json({ skipped: true, reason: 'campaign not claimable', campaignId }, 200)
    }

    claimedCampaignId = campaignId
    const cycle = campaign.send_cycle ?? 1

    // -----------------------------------------------------------------------
    // Build the outstanding recipient list.
    // -----------------------------------------------------------------------
    const alreadySent = await fetchAlreadySent(adminClient, campaignId, cycle)
    const pending = audience.emails.filter(e => !alreadySent.has(e))

    // -----------------------------------------------------------------------
    // Bounded runs resume the same campaign; one-recipient requests make batch
    // membership stable even when the audience changes between runs. Ambiguous
    // attempts remain held in email_attempts until independently reviewed.
    // -----------------------------------------------------------------------
    const result = await sendMarketingRecipients(adminClient, campaign, cycle, pending, { apiKey: resendApiKey })
    const { sentCount, failedCount, complete } = result

    const { error: historyError } = await adminClient.from('email_campaign_sends').insert({
      campaign_id: campaignId,
      sent_count: sentCount,
      failed_count: failedCount,
      total_recipients: audience.total,
    })
    if (historyError) throw Error('Send history unavailable; review the existing campaign before resuming')

    // Only advance/close the campaign once everyone has actually been mailed.
    // Otherwise just drop the lease so the next run resumes where this stopped.
    const { error: releaseError } = await adminClient.rpc('release_campaign_claim', {
      p_campaign_id: campaignId,
      p_completed: complete,
    })
    if (releaseError) throw Error('Campaign completion could not be recorded; review the existing campaign before resuming')

    return json({
      success: true,
      campaignId,
      cycle,
      ...result,
      acceptedCount: alreadySent.size + result.acceptedCount,
      skippedAlreadySent: alreadySent.size,
      ...eligibility,
    })
  } catch (error) {
    console.error('Error:', error)
    // Never leave a lease dangling on an unexpected failure.
    if (claimedCampaignId !== null) {
      try {
        await adminClient.rpc('release_campaign_claim', {
          p_campaign_id: claimedCampaignId,
          p_completed: false,
        })
      } catch { /* lease expires on its own after LEASE_SECONDS */ }
    }
    return json({ error: (error as Error).message, ...(claimedCampaignId !== null ? { campaignId: claimedCampaignId } : {}) }, 500)
  }
})
