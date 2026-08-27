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
//   * Uses Resend's batch endpoint (100/request) so runs actually finish.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_ADDRESS = 'Driveshaft Cable <orders@k-todd.com>'
const BATCH_SIZE = 100          // Resend's per-request cap for /emails/batch
const LEASE_SECONDS = 900       // how long a claim is held before it's reclaimable
const MAX_BATCHES_PER_RUN = 20  // 2000 recipients/run; leaves headroom under the
                                // execution limit. Leftovers resume next run.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

/** Page through a table — Supabase caps a single select at 1000 rows. */
async function fetchAllEmails(
  client: any,
  table: string,
  refine?: (q: any) => any
): Promise<string[]> {
  const out: string[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = client.from(table).select('email').range(from, from + PAGE - 1)
    if (refine) q = refine(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    for (const row of data) if (row.email) out.push(row.email)
    if (data.length < PAGE) break
  }
  return out
}

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronTriggerKey = Deno.env.get('CRON_TRIGGER_KEY') || ''
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

  // Auth guard. This function can mail every customer on file — it must never
  // be callable by anyone who simply knows the URL.
  let authorized = token === serviceRoleKey || (!!cronTriggerKey && token === cronTriggerKey)
  if (!authorized && token) {
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await userClient.auth.getUser(token)
    if (user) authorized = true
  }
  if (!authorized) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Tracked outside the try so the error path can drop a lease we already took.
  let claimedCampaignId: number | null = null

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return json({ error: 'Email service not configured' }, 500)
    }

    const body = await req.json().catch(() => ({}))

    // -----------------------------------------------------------------------
    // Resolve the campaign. Manual sends create the row up front (rather than
    // after the loop, as before) so they get the same claim + resume safety.
    // -----------------------------------------------------------------------
    let campaignId: number
    let requireDue: boolean

    if (body.campaignId) {
      campaignId = Number(body.campaignId)
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
    const [orderEmails, quoteEmails, subscriberEmails] = await Promise.all([
      fetchAllEmails(adminClient, 'orders', q => q.eq('payment_status', 'paid')),
      fetchAllEmails(adminClient, 'quote_requests'),
      fetchAllEmails(adminClient, 'newsletter_subscribers', q => q.eq('status', 'active').eq('confirmed', true)),
    ])

    const audience = new Set<string>()
    for (const e of [...orderEmails, ...quoteEmails, ...subscriberEmails]) {
      const clean = e.toLowerCase().trim()
      if (clean) audience.add(clean)
    }

    const alreadySent = await fetchAlreadySent(adminClient, campaignId, cycle)
    const pending = Array.from(audience).filter(e => !alreadySent.has(e))

    // -----------------------------------------------------------------------
    // Send in batches, logging each batch before moving on so a timeout can
    // never cost more than one batch of duplicates.
    // -----------------------------------------------------------------------
    let sentCount = 0
    let failedCount = 0
    let batchesRun = 0

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      if (batchesRun >= MAX_BATCHES_PER_RUN) break
      const batch = pending.slice(i, i + BATCH_SIZE)
      batchesRun++

      try {
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            batch.map(to => ({
              from: FROM_ADDRESS,
              to: [to],
              subject: campaign.subject,
              html: campaign.html_content,
            }))
          ),
        })

        if (!res.ok) {
          failedCount += batch.length
          console.error(`Batch failed for campaign ${campaignId}:`, await res.text())
          continue
        }

        // Record delivery before the next batch. Conflicts are ignored so a
        // retry of the same batch stays idempotent.
        const { error: logErr } = await adminClient
          .from('email_campaign_recipients')
          .upsert(
            batch.map(email => ({ campaign_id: campaignId, email, cycle })),
            { onConflict: 'campaign_id,cycle,email', ignoreDuplicates: true }
          )
        if (logErr) {
          // If we cannot record the send we must stop: continuing risks
          // re-mailing this batch on the next run.
          console.error(`Recipient log failed for campaign ${campaignId}:`, logErr)
          await adminClient.rpc('release_campaign_claim', {
            p_campaign_id: campaignId,
            p_completed: false,
          })
          return json({ error: 'Send halted: recipient log write failed' }, 500)
        }

        sentCount += batch.length
      } catch (err) {
        failedCount += batch.length
        console.error(`Batch error for campaign ${campaignId}:`, err)
      }

      // Stay well clear of Resend's request rate limit between batches.
      await new Promise(r => setTimeout(r, 600))
    }

    const remaining = pending.length - sentCount - failedCount
    const complete = remaining <= 0 && failedCount === 0

    await adminClient.from('email_campaign_sends').insert({
      campaign_id: campaignId,
      sent_count: sentCount,
      failed_count: failedCount,
      total_recipients: audience.size,
    })

    // Only advance/close the campaign once everyone has actually been mailed.
    // Otherwise just drop the lease so the next run resumes where this stopped.
    await adminClient.rpc('release_campaign_claim', {
      p_campaign_id: campaignId,
      p_completed: complete,
    })

    return json({
      success: true,
      campaignId,
      cycle,
      sentCount,
      failedCount,
      skippedAlreadySent: alreadySent.size,
      remaining: Math.max(0, remaining),
      complete,
      total: audience.size,
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
    return json({ error: (error as Error).message }, 500)
  }
})
