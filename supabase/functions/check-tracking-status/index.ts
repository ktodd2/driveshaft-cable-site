// Polls EasyPost for every shipped order's tracking status. When EasyPost
// reports a package as delivered, flips order.status to 'delivered', sets
// delivered_at, and fires the send-delivery-email function.
//
// Intended trigger: pg_cron schedule '0 9,17 * * *' (twice daily). Also
// directly invokable from the Supabase dashboard for manual testing.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// EasyPost expects carrier codes in uppercase. UI dropdown stores them
// lowercase ('ups', 'usps'); extend this map if new carriers are added.
function mapCarrier(c: string | null | undefined): string {
  if (!c) return 'UPS'
  return c.toUpperCase()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const easyKey = Deno.env.get('EASYPOST_API_KEY')
  if (!easyKey) {
    return new Response(
      JSON.stringify({ error: 'EASYPOST_API_KEY not set' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supa = createClient(supabaseUrl, serviceKey)

  const { data: shippedOrders, error: queryError } = await supa
    .from('orders')
    .select('id, email, name, tracking_number, tracking_carrier')
    .eq('status', 'shipped')
    .not('tracking_number', 'is', null)

  if (queryError) {
    console.error('check-tracking-status: query failed', queryError)
    return new Response(
      JSON.stringify({ error: 'Failed to load orders', details: queryError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  const stats = { checked: 0, delivered: 0, errors: 0, results: [] as any[] }

  for (const order of shippedOrders || []) {
    try {
      const carrier = mapCarrier(order.tracking_carrier)
      // POST /v2/trackers is the canonical "give me the latest status" call —
      // EasyPost de-dupes by tracking_code + carrier, so repeat calls return
      // the same tracker row. Counts as one API call per check against your
      // monthly quota.
      const resp = await fetch('https://api.easypost.com/v2/trackers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${easyKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracker: {
            tracking_code: order.tracking_number,
            carrier,
          },
        }),
      })
      const tracker = await resp.json()

      if (!resp.ok) {
        // EasyPost returns 4xx with { error: { message } } for unrecognized
        // tracking codes etc. Don't crash the whole loop on one bad number —
        // log it, count it, move on.
        console.warn('EasyPost rejected', order.id, tracker)
        stats.errors++
        stats.results.push({ orderId: order.id, error: tracker?.error?.message || resp.statusText })
        continue
      }

      const nowIso = new Date().toISOString()
      stats.checked++

      if (tracker.status === 'delivered') {
        const { error: updateError } = await supa
          .from('orders')
          .update({
            status: 'delivered',
            delivered_at: nowIso,
            tracking_status: 'delivered',
            tracking_last_checked_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', order.id)

        if (updateError) {
          console.error('update to delivered failed', order.id, updateError)
          stats.errors++
          stats.results.push({ orderId: order.id, error: updateError.message })
          continue
        }

        stats.delivered++
        stats.results.push({ orderId: order.id, status: 'delivered' })

        // Best-effort delivery email — don't block the loop or fail the
        // function if Resend hiccups.
        if (order.email) {
          try {
            await supa.functions.invoke('send-delivery-email', {
              body: {
                customerEmail: order.email,
                customerName: order.name,
                orderId: order.id,
              },
            })
          } catch (mailErr) {
            console.warn('delivery email send failed for', order.id, mailErr)
          }
        }
      } else {
        // Not delivered yet — just update tracking_status + last_checked_at
        // so the admin can see "out_for_delivery" / "in_transit" in the UI.
        const { error: updateError } = await supa
          .from('orders')
          .update({
            tracking_status: tracker.status || 'unknown',
            tracking_last_checked_at: nowIso,
          })
          .eq('id', order.id)

        if (updateError) {
          console.error('update tracking_status failed', order.id, updateError)
          stats.errors++
          stats.results.push({ orderId: order.id, error: updateError.message })
          continue
        }

        stats.results.push({ orderId: order.id, status: tracker.status })
      }
    } catch (err) {
      console.error('check-tracking-status: tracker call failed for', order.id, err)
      stats.errors++
      stats.results.push({ orderId: order.id, error: (err as Error).message })
    }
  }

  return new Response(
    JSON.stringify(stats),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
