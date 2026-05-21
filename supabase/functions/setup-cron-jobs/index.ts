// One-time setup function. Idempotent and safe to re-run.
//
// Reads CRON_TRIGGER_KEY from edge function env (set via `supabase secrets set`)
// and schedules the four email-automation cron jobs via the schedule_email_cron
// SQL helper. After running once, the cron jobs persist independently — this
// function can be re-invoked to re-schedule them (e.g., if you rotate the key).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROJECT_REF = 'twrihhyfvomqiqbxkitc'
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`

interface CronJob {
  name: string
  schedule: string
  functionSlug: string
  description: string
}

const CRON_JOBS: CronJob[] = [
  {
    name: 'send-abandoned-cart-hourly',
    schedule: '5 * * * *',
    functionSlug: 'send-abandoned-cart',
    description: 'Hourly at :05 — recovery emails for abandoned carts',
  },
  {
    name: 'send-welcome-series-15min',
    schedule: '*/15 * * * *',
    functionSlug: 'send-welcome-series',
    description: 'Every 15 minutes — welcome series stage advancement',
  },
  {
    name: 'send-reorder-reminder-daily',
    schedule: '0 14 * * *',
    functionSlug: 'send-reorder-reminder',
    description: 'Daily at 14:00 UTC — 30-day reorder reminders',
  },
  {
    name: 'send-winback-weekly',
    schedule: '0 14 * * 1',
    functionSlug: 'send-winback',
    description: 'Mondays at 14:00 UTC — 6-9 month win-back campaign',
  },
  {
    name: 'check-tracking-twice-daily',
    schedule: '0 9,17 * * *',
    functionSlug: 'check-tracking-status',
    description: '9:00 + 17:00 UTC — poll EasyPost; auto-flip delivered orders + send delivery emails',
  },
]

serve(async (_req) => {
  const cronKey = Deno.env.get('CRON_TRIGGER_KEY')
  if (!cronKey) {
    return new Response(
      JSON.stringify({ error: 'CRON_TRIGGER_KEY env var not set. Run: supabase secrets set CRON_TRIGGER_KEY=<value>' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const results: Record<string, string> = {}

  for (const job of CRON_JOBS) {
    const { error } = await supabase.rpc('schedule_email_cron', {
      job_name: job.name,
      cron_schedule: job.schedule,
      function_url: `${FUNCTIONS_BASE}/${job.functionSlug}`,
      trigger_key: cronKey,
    })
    results[job.name] = error ? `failed: ${error.message}` : `scheduled: ${job.description}`
  }

  // List what's actually in cron.job now for the response so the caller
  // can verify everything took.
  const { data: liveJobs } = await supabase.rpc('list_email_cron_jobs')

  return new Response(
    JSON.stringify({ results, liveJobs: liveJobs || [] }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
