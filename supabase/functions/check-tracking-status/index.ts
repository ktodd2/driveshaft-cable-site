// Polls USPS and UPS for every shipped order's tracking status, normalizes
// the carrier-specific status into a common vocabulary, and when a package
// is delivered flips order.status to 'delivered', sets delivered_at, and
// fires the send-delivery-email function.
//
// Trigger: pg_cron schedule '0 9,17 * * *' (twice daily, registered via
// the setup-cron-jobs function). Also directly invokable from the Supabase
// dashboard with an empty body for manual testing.
//
// Required secrets (set with `supabase secrets set`):
//   USPS_CLIENT_ID, USPS_CLIENT_SECRET — from developer.usps.com
//   UPS_CLIENT_ID, UPS_CLIENT_SECRET — from developer.ups.com
//
// If a carrier's secrets are missing the function still runs — orders with
// that carrier get tracking_status='credentials_missing' so it's visible
// in the admin UI which credential is the bottleneck.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalized status values — all writes to orders.tracking_status use these
// so the admin UI's prettyTrackingStatus() helper stays carrier-agnostic.
type NormStatus =
  | 'delivered'
  | 'out_for_delivery'
  | 'in_transit'
  | 'pre_transit'
  | 'exception'
  | 'unknown'
  | 'credentials_missing'
  | 'lookup_failed'

interface TrackResult {
  status: NormStatus
  raw?: string  // carrier's original status string for debugging
  error?: string
}

// ---------- USPS ----------

const USPS_TOKEN_URL    = 'https://apis.usps.com/oauth2/v3/token'
const USPS_TRACKING_URL = 'https://apis.usps.com/tracking/v3/tracking'

async function getUspsToken(): Promise<string | null> {
  const id     = Deno.env.get('USPS_CLIENT_ID')
  const secret = Deno.env.get('USPS_CLIENT_SECRET')
  if (!id || !secret) return null

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     id,
    client_secret: secret,
    scope:         'tracking',
  })

  const resp = await fetch(USPS_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error('USPS token fetch failed', resp.status, text)
    return null
  }
  const json = await resp.json()
  return json.access_token || null
}

// Map USPS status text or eventCategory codes to our normalized vocabulary.
// USPS Tracking v3 returns several fields that can indicate state — we look
// at statusCategory first (broad bucket) and fall back to the most recent
// trackingEvent's eventType.
function normalizeUspsStatus(payload: any): NormStatus {
  const cat = (payload?.statusCategory || '').toLowerCase()
  if (cat.includes('delivered'))             return 'delivered'
  if (cat.includes('out for delivery'))      return 'out_for_delivery'
  if (cat.includes('in transit'))            return 'in_transit'
  if (cat.includes('accepted') ||
      cat.includes('pre-shipment') ||
      cat.includes('label'))                 return 'pre_transit'
  if (cat.includes('alert') ||
      cat.includes('exception'))             return 'exception'

  // Fall back to the most recent tracking event.
  const event = payload?.trackingEvents?.[0]
  const evCat = (event?.eventCategory || event?.eventType || '').toLowerCase()
  if (evCat.includes('deliver') && !evCat.includes('out for delivery')) return 'delivered'
  if (evCat.includes('out for delivery'))   return 'out_for_delivery'
  if (evCat.includes('in transit') ||
      evCat.includes('arrived'))            return 'in_transit'
  return 'unknown'
}

async function checkUsps(trackingNumber: string, token: string): Promise<TrackResult> {
  const url = `${USPS_TRACKING_URL}/${encodeURIComponent(trackingNumber)}?expand=DETAIL`
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (!resp.ok) {
    const text = await resp.text()
    return { status: 'lookup_failed', error: `USPS ${resp.status}: ${text.slice(0, 200)}` }
  }
  const data = await resp.json()
  const status = normalizeUspsStatus(data)
  return { status, raw: data?.statusCategory || data?.statusSummary }
}

// ---------- UPS ----------

const UPS_TOKEN_URL    = 'https://onlinetools.ups.com/security/v1/oauth/token'
const UPS_TRACKING_URL = 'https://onlinetools.ups.com/api/track/v1/details'

async function getUpsToken(): Promise<string | null> {
  const id     = Deno.env.get('UPS_CLIENT_ID')
  const secret = Deno.env.get('UPS_CLIENT_SECRET')
  if (!id || !secret) return null

  const basic = btoa(`${id}:${secret}`)
  const body  = new URLSearchParams({ grant_type: 'client_credentials' })

  const resp = await fetch(UPS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Accept':        'application/json',
    },
    body,
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error('UPS token fetch failed', resp.status, text)
    return null
  }
  const json = await resp.json()
  return json.access_token || null
}

// UPS returns a status code (e.g. '011' for Delivered) AND a description
// (e.g. 'Delivered', 'Out For Delivery'). Description is more readable and
// stable across UPS API versions; we lean on it first.
function normalizeUpsStatus(payload: any): NormStatus {
  const pkg = payload?.trackResponse?.shipment?.[0]?.package?.[0]
  const desc = (pkg?.currentStatus?.description || '').toLowerCase()
  const code = pkg?.currentStatus?.code || ''

  if (desc.includes('delivered'))       return 'delivered'
  if (code === '011')                   return 'delivered'
  if (desc.includes('out for delivery')) return 'out_for_delivery'
  if (code === '005' || code === 'M')   return 'out_for_delivery' // varies by API
  if (desc.includes('in transit') ||
      desc.includes('arrived') ||
      desc.includes('on the way'))      return 'in_transit'
  if (desc.includes('label') ||
      desc.includes('pre') ||
      desc.includes('order processed')) return 'pre_transit'
  if (desc.includes('exception') ||
      desc.includes('delayed') ||
      desc.includes('returned'))        return 'exception'
  return 'unknown'
}

async function checkUps(trackingNumber: string, token: string): Promise<TrackResult> {
  // UPS requires a transId (unique-per-request) and transactionSrc header.
  const transId = crypto.randomUUID()
  const url = `${UPS_TRACKING_URL}/${encodeURIComponent(trackingNumber)}`
  const resp = await fetch(url, {
    headers: {
      'Authorization':   `Bearer ${token}`,
      'transId':         transId,
      'transactionSrc':  'driveshaftcable',
      'Accept':          'application/json',
    },
  })
  if (!resp.ok) {
    const text = await resp.text()
    return { status: 'lookup_failed', error: `UPS ${resp.status}: ${text.slice(0, 200)}` }
  }
  const data = await resp.json()
  const status = normalizeUpsStatus(data)
  const raw = data?.trackResponse?.shipment?.[0]?.package?.[0]?.currentStatus?.description
  return { status, raw }
}

// ---------- handler ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supa = createClient(supabaseUrl, serviceKey)

  // Fetch OAuth tokens once per invocation (instead of per order). null means
  // creds for that carrier aren't set — we still process the OTHER carrier.
  const [uspsToken, upsToken] = await Promise.all([getUspsToken(), getUpsToken()])

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

  const stats = {
    checked:   0,
    delivered: 0,
    errors:    0,
    uspsToken: Boolean(uspsToken),
    upsToken:  Boolean(upsToken),
    results:   [] as any[],
  }

  for (const order of shippedOrders || []) {
    const carrier = (order.tracking_carrier || '').toLowerCase()
    let result: TrackResult

    try {
      if (carrier === 'usps') {
        if (!uspsToken) {
          result = { status: 'credentials_missing', error: 'USPS_CLIENT_ID/SECRET not set' }
        } else {
          result = await checkUsps(order.tracking_number, uspsToken)
        }
      } else if (carrier === 'ups') {
        if (!upsToken) {
          result = { status: 'credentials_missing', error: 'UPS_CLIENT_ID/SECRET not set' }
        } else {
          result = await checkUps(order.tracking_number, upsToken)
        }
      } else {
        result = { status: 'unknown', error: `unsupported carrier: ${carrier || '(none)'}` }
      }
    } catch (err) {
      result = { status: 'lookup_failed', error: (err as Error).message }
    }

    const nowIso = new Date().toISOString()

    if (result.status === 'delivered') {
      const { error: updateError } = await supa
        .from('orders')
        .update({
          status:                    'delivered',
          delivered_at:              nowIso,
          tracking_status:           'delivered',
          tracking_last_checked_at:  nowIso,
          updated_at:                nowIso,
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('update to delivered failed', order.id, updateError)
        stats.errors++
        stats.results.push({ orderId: order.id, error: updateError.message })
        continue
      }

      stats.checked++
      stats.delivered++
      stats.results.push({ orderId: order.id, carrier, status: 'delivered', raw: result.raw })

      if (order.email) {
        try {
          await supa.functions.invoke('send-delivery-email', {
            body: {
              customerEmail: order.email,
              customerName:  order.name,
              orderId:       order.id,
            },
          })
        } catch (mailErr) {
          // Best effort — log but don't block the rest of the loop.
          console.warn('delivery email send failed for', order.id, mailErr)
        }
      }
    } else {
      // Not delivered. Update tracking_status + last_checked_at so the admin
      // can see "out_for_delivery" / "in_transit" / "credentials_missing"
      // in the order detail pane.
      const isError = result.status === 'lookup_failed'
      const { error: updateError } = await supa
        .from('orders')
        .update({
          tracking_status:          result.status,
          tracking_last_checked_at: nowIso,
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('update tracking_status failed', order.id, updateError)
        stats.errors++
        stats.results.push({ orderId: order.id, error: updateError.message })
        continue
      }

      stats.checked++
      if (isError) stats.errors++
      stats.results.push({
        orderId: order.id,
        carrier,
        status:  result.status,
        raw:     result.raw,
        ...(result.error ? { error: result.error } : {}),
      })
    }
  }

  return new Response(
    JSON.stringify(stats),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})
