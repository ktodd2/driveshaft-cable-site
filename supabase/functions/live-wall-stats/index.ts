import { createApiClient } from '../_shared/supabaseTransport.js'
import { getSupabaseSecretKey } from '../_shared/supabaseKeys.js'
// live-wall-stats — read-only aggregate feed for Kurtis's live wall dashboard
// (houstontruckwreck.onrender.com/live). Custom bearer-token auth; deployed
// with verify_jwt=false because the caller is a server, not a Supabase user.
import { createClient } from 'npm:@supabase/supabase-js@2'

const WALL_TOKEN = Deno.env.get('LIVE_WALL_TOKEN')

const supabase = createApiClient(createClient,
  Deno.env.get('SUPABASE_URL')!,
  getSupabaseSecretKey()!,
)

// Mirrors src/lib/costCalculations.js on the admin site.
function weightedAvgCostByProduct(shipments: any[]): Record<string, number> {
  const totals: Record<string, { qty: number; cost: number }> = {}
  for (const s of shipments || []) {
    const pid = String(s.product_id ?? '1')
    if (!totals[pid]) totals[pid] = { qty: 0, cost: 0 }
    totals[pid].qty += s.quantity || 0
    totals[pid].cost += s.total_cost_cents || 0
  }
  const out: Record<string, number> = {}
  for (const pid of Object.keys(totals)) {
    out[pid] = totals[pid].qty > 0 ? Math.round(totals[pid].cost / totals[pid].qty) : 0
  }
  return out
}

function orderProfit(order: any, costMap: Record<string, number>) {
  const items = order.items || []
  const units = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)
  const productCost = items.reduce((sum: number, i: any) =>
    sum + (i.quantity || 0) * (costMap[String(i.productId)] ?? 0), 0)
  const shippingCost = order.actual_shipping_cost_cents != null ? order.actual_shipping_cost_cents : 0
  const incursStripeFee = order.payment_method == null || order.payment_method === 'stripe'
  const stripeFee = incursStripeFee ? Math.round((order.total_cents || 0) * 0.029) + 30 : 0
  const profit = (order.total_cents || 0) - productCost - shippingCost - stripeFee
  return { units, profit }
}

function itemsSummary(items: any[]): string {
  return (items || [])
    .map((i: any) => `${i.quantity || 0}× ${i.name || 'item'}`)
    .join(', ')
}

// Start of "today" in America/Chicago, as a Date.
function chicagoMidnight(now: Date): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]))
  const elapsedMs = ((+parts.hour % 24) * 3600 + +parts.minute * 60 + +parts.second) * 1000
  return new Date(now.getTime() - elapsedMs)
}

function summarize(orders: any[], costMap: Record<string, number>, since: Date) {
  let revenue = 0, profit = 0, units = 0, count = 0
  for (const o of orders) {
    if (new Date(o.created_at) < since) continue
    const p = orderProfit(o, costMap)
    revenue += o.total_cents || 0
    profit += p.profit
    units += p.units
    count += 1
  }
  return {
    revenue_cents: revenue,
    profit_cents: profit,
    margin_pct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    orders: count,
    units,
    avg_order_cents: count > 0 ? Math.round(revenue / count) : 0,
  }
}

Deno.serve(async (req: Request) => {
  const supplied = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (supplied !== WALL_TOKEN) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const now = new Date()
    const d90 = new Date(now.getTime() - 90 * 86400000).toISOString()

    const [unfilledRes, awaitingRes, paidRes, shipRes, lastSaleRes] = await Promise.all([
      supabase.from('orders')
        .select('id, name, company, shipping_address, items, total_cents, payment_method, created_at, status')
        .eq('payment_status', 'paid')
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: true })
        .limit(50),
      supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed'])
        .or('payment_status.is.null,payment_status.eq.pending'),
      supabase.from('orders')
        .select('total_cents, created_at, items, actual_shipping_cost_cents, payment_method')
        .eq('payment_status', 'paid')
        .neq('status', 'cancelled')
        .gte('created_at', d90),
      supabase.from('product_shipments')
        .select('product_id, quantity, total_cost_cents'),
      supabase.from('orders')
        .select('total_cents, created_at, items')
        .eq('payment_status', 'paid')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const firstError = unfilledRes.error || awaitingRes.error || paidRes.error || shipRes.error || lastSaleRes.error
    if (firstError) throw firstError

    const costMap = weightedAvgCostByProduct(shipRes.data || [])
    const paid = paidRes.data || []

    const unfilled = (unfilledRes.data || []).map((o: any) => {
      const addr = o.shipping_address || {}
      const ageMs = now.getTime() - new Date(o.created_at).getTime()
      return {
        id: String(o.id).slice(0, 8),
        name: o.name || 'Unknown',
        company: o.company || null,
        place: [addr.city, addr.state].filter(Boolean).join(', ') || null,
        items: itemsSummary(o.items),
        total_cents: o.total_cents || 0,
        payment_method: o.payment_method || 'stripe',
        created_at: o.created_at,
        age_hours: Math.floor(ageMs / 3600000),
      }
    })

    const last = (lastSaleRes.data || [])[0] || null
    const lastSale = last ? {
      created_at: last.created_at,
      total_cents: last.total_cents || 0,
      items: itemsSummary(last.items),
      days_ago: Math.floor((now.getTime() - new Date(last.created_at).getTime()) / 86400000),
    } : null

    const body = {
      ok: true,
      generated_at: now.toISOString(),
      unfilled,
      unfilled_count: unfilled.length,
      awaiting_payment_count: awaitingRes.count || 0,
      last_sale: lastSale,
      kpis: {
        today: summarize(paid, costMap, chicagoMidnight(now)),
        d7: summarize(paid, costMap, new Date(now.getTime() - 7 * 86400000)),
        d30: summarize(paid, costMap, new Date(now.getTime() - 30 * 86400000)),
        d90: summarize(paid, costMap, new Date(now.getTime() - 90 * 86400000)),
      },
      notes: {
        profit: 'total - product cost (weighted avg from shipments) - actual shipping (0 if not yet imported) - card fee (2.9%+30c, waived for cash/zelle/cashapp)',
      },
    }

    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
