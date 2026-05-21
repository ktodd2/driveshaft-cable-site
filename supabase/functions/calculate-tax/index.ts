// Calculates sales tax for a checkout via the Stripe Tax API.
//
// This is a *quote* endpoint — it produces a tax.calculation in Stripe which
// the frontend uses to display the tax line and which create-payment-intent
// later attaches to the PaymentIntent. The calculation only becomes a
// reportable tax transaction when stripe-webhook calls
// stripe.tax.transactions.createFromCalculation() after payment succeeds.
//
// Tax is calculated against server-trusted prices, NOT amounts sent by the
// client, so a tampered cart cannot reduce the tax owed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import {
  computeShipping,
  createAdminClient,
  getPriceForQuantityFromDb,
  makeDbCache,
} from '../_shared/pricing.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// txcd_99999999 = "General — Tangible Goods", Stripe's catch-all for physical
// products. If a more specific code for automotive parts is added to the
// Stripe Dashboard later, update this constant.
const PRODUCT_TAX_CODE = 'txcd_99999999'
const SHIPPING_TAX_CODE = 'txcd_92010001' // "Shipping" — taxability varies by state, Stripe handles it

interface CartItem {
  productId: string
  name?: string
  quantity: number
}

interface ShippingAddress {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

function isAddressTaxable(addr: ShippingAddress | undefined): boolean {
  // Stripe Tax needs at minimum a postal code + country to determine
  // jurisdiction. Without those it cannot return a meaningful rate.
  if (!addr) return false
  if (!addr.country) return false
  if (!addr.postal_code || addr.postal_code.trim().length < 5) return false
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { items, shippingAddress, discountCents = 0 } = await req.json() as {
      items: CartItem[]
      shippingAddress: ShippingAddress
      discountCents?: number
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'items is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Bail early with $0 tax if the address can't be jurisdiction-resolved.
    // The frontend will simply not display a tax line.
    if (!isAddressTaxable(shippingAddress)) {
      return new Response(
        JSON.stringify({ taxCents: 0, calculationId: null, reason: 'address_incomplete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Server-side price computation. Volume tier qualifies per-product (each
    // line item's tier is based on its own quantity). Prices come from the
    // `products` table so admin edits via /admin/products take effect for
    // tax calculations immediately; falls back to the hardcoded constant in
    // pricing.ts if a row can't be resolved.
    const adminClient = createAdminClient()
    const dbCache = makeDbCache()
    const linePrices = await Promise.all(items.map(async (item) => ({
      productId: item.productId,
      quantity: item.quantity || 0,
      unitPrice: await getPriceForQuantityFromDb(
        item.productId,
        item.quantity || 0,
        adminClient,
        dbCache,
      ),
    })))
    const subtotalCents = linePrices.reduce(
      (sum, l) => sum + l.unitPrice * l.quantity,
      0
    )
    const shippingCents = computeShipping(subtotalCents)

    // Apply the loyalty discount proportionally across line items. Tax is
    // calculated on the post-discount amount because most US jurisdictions
    // tax the net price the customer actually pays.
    const safeDiscount = Math.max(0, Math.min(discountCents, subtotalCents))
    const discountRatio = subtotalCents > 0 ? safeDiscount / subtotalCents : 0

    const lineItems = linePrices.map((line) => {
      const lineGross = line.unitPrice * line.quantity
      const lineNet = Math.round(lineGross * (1 - discountRatio))
      return {
        amount: lineNet,
        reference: line.productId,
        quantity: line.quantity,
        tax_code: PRODUCT_TAX_CODE,
        tax_behavior: 'exclusive' as const,
      }
    })

    const calculation = await stripe.tax.calculations.create({
      currency: 'usd',
      line_items: lineItems,
      customer_details: {
        address: {
          line1: shippingAddress.line1 || '',
          line2: shippingAddress.line2 || undefined,
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country || 'US',
        },
        address_source: 'shipping',
      },
      shipping_cost: shippingCents > 0
        ? { amount: shippingCents, tax_code: SHIPPING_TAX_CODE, tax_behavior: 'exclusive' }
        : undefined,
      expand: ['line_items.data'],
    })

    return new Response(
      JSON.stringify({
        taxCents: calculation.tax_amount_exclusive,
        calculationId: calculation.id,
        subtotalCents,
        shippingCents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('calculate-tax error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Tax calculation failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
