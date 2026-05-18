import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json()
    let subject: string
    let htmlContent: string
    let campaignId: number | null = null

    if (body.campaignId) {
      // Scheduled/recurring mode — fetch campaign from DB
      const { data: campaign, error: fetchErr } = await adminClient
        .from('email_campaigns')
        .select('*')
        .eq('id', body.campaignId)
        .single()

      if (fetchErr || !campaign) {
        return new Response(
          JSON.stringify({ error: 'Campaign not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      subject = campaign.subject
      htmlContent = campaign.html_content
      campaignId = campaign.id
    } else if (body.subject && body.htmlContent) {
      // Manual send mode
      subject = body.subject
      htmlContent = body.htmlContent
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide either { subject, htmlContent } or { campaignId }' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Collect unique emails from orders, quotes, and newsletter subscribers
    const [{ data: orders }, { data: quotes }, { data: subscribers }] = await Promise.all([
      adminClient.from('orders').select('email').eq('payment_status', 'paid'),
      adminClient.from('quote_requests').select('email'),
      adminClient.from('newsletter_subscribers').select('email').eq('status', 'active'),
    ])

    const allEmails = new Set<string>()
    ;(orders ?? []).forEach((r: any) => r.email && allEmails.add(r.email.toLowerCase().trim()))
    ;(quotes ?? []).forEach((r: any) => r.email && allEmails.add(r.email.toLowerCase().trim()))
    ;(subscribers ?? []).forEach((r: any) => r.email && allEmails.add(r.email.toLowerCase().trim()))

    const recipients = Array.from(allEmails)

    let sentCount = 0
    let failedCount = 0

    for (const to of recipients) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Driveshaft Cable <orders@k-todd.com>',
            to: [to],
            subject,
            html: htmlContent,
          }),
        })
        if (res.ok) {
          sentCount++
        } else {
          failedCount++
          console.error(`Failed to send to ${to}:`, await res.text())
        }
      } catch (err) {
        failedCount++
        console.error(`Error sending to ${to}:`, err)
      }
      // Throttle: 1 second between sends to stay under Resend rate limit (2/sec)
      await new Promise(r => setTimeout(r, 1000))
    }

    if (campaignId) {
      // Scheduled/recurring: log send and update campaign
      await adminClient.from('email_campaign_sends').insert({
        campaign_id: campaignId,
        sent_count: sentCount,
        failed_count: failedCount,
        total_recipients: recipients.length,
      })

      // Fetch campaign again for send_type info
      const { data: campaign } = await adminClient
        .from('email_campaigns')
        .select('send_type, recurrence')
        .eq('id', campaignId)
        .single()

      if (campaign?.send_type === 'recurring' && campaign.recurrence) {
        // Calculate next send time
        const now = new Date()
        let nextSend: Date
        switch (campaign.recurrence) {
          case 'weekly':
            nextSend = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            break
          case 'biweekly':
            nextSend = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
            break
          case 'monthly':
            nextSend = new Date(now)
            nextSend.setMonth(nextSend.getMonth() + 1)
            break
          default:
            nextSend = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
        await adminClient
          .from('email_campaigns')
          .update({ last_sent_at: now.toISOString(), next_send_at: nextSend.toISOString() })
          .eq('id', campaignId)
      } else {
        // One-time scheduled: mark as sent
        await adminClient
          .from('email_campaigns')
          .update({ last_sent_at: new Date().toISOString(), status: 'sent', next_send_at: null })
          .eq('id', campaignId)
      }
    } else {
      // Manual send: create campaign + send record
      const { data: newCampaign } = await adminClient
        .from('email_campaigns')
        .insert({
          subject,
          html_content: htmlContent,
          send_type: 'immediate',
          status: 'sent',
          last_sent_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (newCampaign) {
        await adminClient.from('email_campaign_sends').insert({
          campaign_id: newCampaign.id,
          sent_count: sentCount,
          failed_count: failedCount,
          total_recipients: recipients.length,
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, failedCount, total: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
