import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { observeEmailRun } from '../_shared/emailHealth.js'
import { authorizeStoreRequest } from '../_shared/storeAuthorization.js'
import { createApiClient } from '../_shared/supabaseTransport.js'
import { getSupabaseSecretKey } from '../_shared/supabaseKeys.js'
import { normalizeTracking, parseUsps, parseUps, applyTrackingResult } from '../_shared/trackingSync.js'

// Admin order bookkeeping only. No customer email, SMS, or marketing calls.
// Existing cron auth is retained. Missing credentials never imply delivery.
const carriers = {
  usps: { token: 'https://apis.usps.com/oauth2/v3/token', tracking: 'https://apis.usps.com/tracking/v3/tracking', parse: (...args: any[]) => parseUsps(...args) },
  ups: { token: 'https://onlinetools.ups.com/security/v1/oauth/token', tracking: 'https://onlinetools.ups.com/api/track/v1/details', parse: (...args: any[]) => parseUps(...args) },
}
async function tokenFor(carrier: string) {
  const id = Deno.env.get(`${carrier.toUpperCase()}_CLIENT_ID`)
  const secret = Deno.env.get(`${carrier.toUpperCase()}_CLIENT_SECRET`)
  if (!id || !secret) return { status: 'credentials_missing' }
  try {
    const isUsps = carrier === 'usps'
    const response = await fetch(carriers[carrier].token, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': isUsps ? 'application/json' : 'application/x-www-form-urlencoded',
        ...(isUsps ? {} : { Authorization: `Basic ${btoa(`${id}:${secret}`)}` }) },
      body: isUsps ? JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret }) : new URLSearchParams({ grant_type: 'client_credentials' }),
    })
    if (!response.ok) return { status: 'lookup_failed', error: `${carrier}_authentication_${response.status}` }
    const body = await response.json()
    return typeof body.access_token === 'string' && body.access_token ? { token: body.access_token } : { status: 'lookup_failed', error: `${carrier}_authentication_invalid` }
  } catch { return { status: 'lookup_failed', error: `${carrier}_authentication_unavailable` } }
}
async function lookup(order: any, credentials: any) {
  const carrier = String(order.tracking_carrier || '').trim().toLowerCase()
  if (!carriers[carrier]) return { status: 'unknown', error: 'unsupported_carrier' }
  const number = normalizeTracking(order.tracking_number)
  if (!(carrier === 'ups' ? /^1Z[A-Z0-9]{16}$/ : /^(?:\d{20,22}|[A-Z]{2}\d{9}[A-Z]{2})$/).test(number)) return { status: 'unknown', error: 'invalid_tracking_number' }
  const auth = credentials[carrier]
  if (!auth.token) return { status: auth.status, error: auth.error || `${carrier}_credentials_missing` }
  try {
    const url = `${carriers[carrier].tracking}/${encodeURIComponent(number)}${carrier === 'usps' ? '?expand=DETAIL' : '?locale=en_US&returnSignature=false'}`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: {
      Authorization: `Bearer ${auth.token}`, Accept: 'application/json',
      ...(carrier === 'ups' ? { transId: crypto.randomUUID(), transactionSrc: 'driveshaftcable' } : {}),
    } })
    if (!response.ok) return { status: 'lookup_failed', error: `${carrier}_tracking_${response.status}` }
    return carriers[carrier].parse(await response.json(), order)
  } catch { return { status: 'lookup_failed', error: `${carrier}_tracking_unavailable` } }
}
serve(async req => {
  if (!await authorizeStoreRequest(req, createClient, { allowCron: true })) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = await req.json().catch(() => ({}))
  const db = createApiClient(createClient, Deno.env.get('SUPABASE_URL'), getSupabaseSecretKey())
  return observeEmailRun(db, 'check-tracking-status', async () => {
    const [usps, ups] = await Promise.all([tokenFor('usps'), tokenFor('ups')])
    const credentials = { usps, ups }
    const availability = Object.fromEntries(Object.entries(credentials).map(([k,v]) => [k, v.token ? 'ready' : v.error || v.status]))
    if (body.diagnostics === true) return Response.json({ carriers: availability, checked: 0, delivered: 0, errors: 0, results: Object.entries(availability).filter(([,v]) => v !== 'ready').map(([carrier,status]) => ({ carrier, status: status === 'credentials_missing' ? status : 'lookup_failed', error: status })) })
    // Rotate oldest checks first; bounded concurrency + execution budget avoid
    // runtime truncation and ensure older unresolved orders cannot starve new ones.
    const { data: orders, error } = await db.from('orders')
      .select('id,status,payment_status,created_at,updated_at,tracking_number,tracking_carrier,tracking_last_checked_at,delivered_at')
      .eq('status','shipped').eq('payment_status','paid').eq('stock_decremented',true).not('tracking_number','is',null)
      .order('tracking_last_checked_at',{ ascending:true, nullsFirst:true }).order('id').limit(200)
    if (error) return Response.json({ error:'Failed to load orders' },{ status:500 })
    const stats = { checked:0, delivered:0, errors:0, skipped:0, deferred:0, carriers:availability, results:[] as any[] }
    let cursor = 0
    const deadline = Date.now() + 90000
    await Promise.all(Array.from({ length:4 }, async () => {
      while (cursor < orders.length && Date.now() < deadline) {
        const order = orders[cursor++]
        const result = await lookup(order, credentials)
        if (body.dryRun === true) { stats.checked++; stats.results.push({ orderId:order.id, ...result }); continue }
        const saved = await applyTrackingResult(db,order,result,new Date().toISOString())
        if (saved.error) { stats.errors++; stats.results.push({ orderId:order.id,error:'tracking_update_failed' }); continue }
        if (!saved.data?.length) { stats.skipped++; continue }
        stats.checked++
        if (result.status === 'delivered') stats.delivered++
        if (result.status === 'lookup_failed') stats.errors++
        stats.results.push({ orderId:order.id,...result })
      }
    }))
    stats.deferred = orders.length - cursor
    return Response.json(stats)
  })
})
