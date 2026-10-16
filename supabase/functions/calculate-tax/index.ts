// Calculates sales tax for a checkout via the Stripe Tax API.
//
// This is a *quote* endpoint — it produces a tax.calculation in Stripe which
// the frontend uses to display the tax line. The amount actually charged is
// recomputed server-side by create-payment-intent, which creates its own
// calculation; that one becomes a reportable tax transaction when
// stripe-webhook calls stripe.tax.transactions.createFromCalculation() after
// payment succeeds.
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
import { createTaxCalculation, isAddressTaxable, ShippingAddress } from '../_shared/tax.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CartItem {
  productId: string
  name?: string
  quantity: number
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

    const { taxCents, calculationId } = await createTaxCalculation(
      stripe, linePrices, subtotalCents, shippingCents, discountCents, shippingAddress,
    )

    return new Response(
      JSON.stringify({
        taxCents,
        calculationId,
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
