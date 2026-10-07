// Public order lookup for /order-tracking.
//
// The customer supplies their email plus either an order number (the order
// UUID, or its first 8+ characters) or their shipping ZIP code. Only paid
// orders are matched, and only status/tracking/item info is returned — never
// address, name, or payment details. Any mismatch returns an empty list so
// the response doesn't reveal whether an email has orders.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MIN_ORDER_REF_LENGTH = 8
const MAX_RESULTS = 10

const getTrackingUrl = (carrier: string, trackingNumber: string) => {
  switch (carrier) {
    case 'ups':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`
    default:
      return null
  }
}

const getCarrierName = (carrier: string | null) => {
  switch (carrier) {
    case 'ups': return 'UPS'
    case 'usps': return 'USPS'
    default: return carrier ? carrier.toUpperCase() : null
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email: rawEmail, reference: rawReference } = await req.json()

    const email = (rawEmail || '').toString().trim().toLowerCase()
    const reference = (rawReference || '').toString().trim().toLowerCase()

    if (!email || !email.includes('@') || !reference) {
      return json({ error: 'Email and order number or ZIP code are required.' }, 400)
    }

    // A 5-digit ZIP (optionally ZIP+4) is treated as a ZIP; anything else as
    // an order number prefix.
    const zipMatch = reference.match(/^(\d{5})(-?\d{4})?$/)
    const zip = zipMatch ? zipMatch[1] : null
    const orderRef = zip ? null : reference.replace(/[^0-9a-f]/g, '')

    if (!zip && (!orderRef || orderRef.length < MIN_ORDER_REF_LENGTH)) {
      return json({ orders: [] })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ilike for case-insensitive email match; escape its wildcards so an
    // address like john_doe@ can't match johnXdoe@.
    const emailPattern = email.replace(/[\\%_]/g, (c) => `\\${c}`)

    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, status, tracking_number, tracking_carrier, delivered_at, items, shipping_address')
      .ilike('email', emailPattern)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('track-order lookup failed:', error)
      return json({ error: 'Could not look up orders, please try again.' }, 500)
    }

    const matches = (data || []).filter((order) => {
      if (zip) {
        const orderZip = (order.shipping_address?.zip || '').toString().trim()
        return orderZip.slice(0, 5) === zip
      }
      return order.id.replace(/-/g, '').startsWith(orderRef!)
    })

    const orders = matches.slice(0, MAX_RESULTS).map((order) => ({
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      placedAt: order.created_at,
      status: order.status,
      deliveredAt: order.delivered_at,
      carrier: getCarrierName(order.tracking_carrier),
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_number
        ? getTrackingUrl(order.tracking_carrier, order.tracking_number)
        : null,
      items: (order.items || []).map((item: { name?: string; quantity?: number }) => ({
        name: item.name,
        quantity: item.quantity,
      })),
    }))

    return json({ orders })
  } catch (err) {
    console.error('track-order error:', err)
    return json({ error: 'Something went wrong, please try again.' }, 500)
  }
})
