// Creates the Stripe PaymentIntent for a checkout.
//
// The charged amount is computed HERE from server-trusted data — never taken
// from the request. The order row (written by CheckoutPage just before this
// call) supplies the items, email and shipping address; prices come from the
// `products` table, discounts are re-validated, shipping is recomputed and
// tax comes from a fresh Stripe Tax calculation. The client still sends the
// total it displayed; if that disagrees with the server total we refuse
// rather than charge an amount the customer never saw.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import {
  computeShipping,
  createAdminClient,
  getPriceForQuantityFromDb,
  makeDbCache,
} from '../_shared/pricing.ts'
import {
  checkDiscountCode,
  isRepeatCustomer,
  REPEAT_CUSTOMER_DISCOUNT,
} from '../_shared/discounts.ts'
import { createTaxCalculation, isAddressTaxable, ShippingAddress } from '../_shared/tax.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

interface OrderItem {
  productId: string
  name?: string
  quantity: number
  price?: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const adminClient = createAdminClient()

    const { amount: clientAmount, orderId, discountCode } = await req.json()

    if (!orderId) return json({ error: 'orderId is required' }, 400)

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, email, items, shipping_address, payment_status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) return json({ error: 'Order not found' }, 400)
    if (order.payment_status === 'paid') return json({ error: 'This order has already been paid.' }, 400)

    const items: OrderItem[] = Array.isArray(order.items) ? order.items : []
    if (items.length === 0) return json({ error: 'Order has no items' }, 400)
    for (const item of items) {
      if (!item?.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return json({ error: 'Order contains an invalid item' }, 400)
      }
    }

    // Validate stock for each item before creating payment
    for (const item of items) {
      const { data: inventory, error: invError } = await adminClient
        .from('product_inventory')
        .select('stock_quantity')
        .eq('product_id', item.productId)
        .single()

      if (invError || !inventory) {
        return json({ error: `Product not found: ${item.productId}` }, 400)
      }

      if (inventory.stock_quantity < item.quantity) {
        return json({
          error: `Insufficient stock. Only ${inventory.stock_quantity} units available.`,
          availableStock: inventory.stock_quantity,
        }, 400)
      }
    }

    // ---- Server-side total ----------------------------------------------
    const dbCache = makeDbCache()
    const lines = await Promise.all(items.map(async (item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: await getPriceForQuantityFromDb(item.productId, item.quantity, adminClient, dbCache),
    })))
    const subtotalCents = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
    const shippingCents = computeShipping(subtotalCents)

    // Loyalty (10%) and codes (5%) are mutually exclusive — larger wins. The
    // rounding expressions match CheckoutPage.jsx exactly.
    const email = (order.email || '').toLowerCase().trim()
    const loyaltyDiscountCents = email && await isRepeatCustomer(email, adminClient)
      ? Math.round(subtotalCents * REPEAT_CUSTOMER_DISCOUNT)
      : 0
    let codeDiscountCents = 0
    let validCode: string | null = null
    if (discountCode) {
      const check = await checkDiscountCode(discountCode, email, adminClient)
      if (check.valid) {
        validCode = check.code
        codeDiscountCents = Math.round(subtotalCents * check.percentOff / 100)
      }
    }
    const discountCents = Math.max(loyaltyDiscountCents, codeDiscountCents)
    const discountSource =
      discountCents === 0 ? null :
      loyaltyDiscountCents >= codeDiscountCents ? 'loyalty' : 'code'

    const addr = order.shipping_address || {}
    const taxAddress: ShippingAddress = {
      line1: addr.address1,
      line2: addr.address2,
      city: addr.city,
      state: addr.state,
      postal_code: addr.zip,
      country: addr.country,
    }
    let taxCents = 0
    let taxCalculationId: string | null = null
    if (isAddressTaxable(taxAddress)) {
      try {
        const tax = await createTaxCalculation(
          stripe, lines, subtotalCents, shippingCents, discountCents, taxAddress,
        )
        taxCents = tax.taxCents
        taxCalculationId = tax.calculationId
      } catch (err) {
        // Same fail-open policy as the checkout quote: a Stripe Tax outage
        // shouldn't block the sale.
        console.error(`create-payment-intent: tax calculation failed for order ${orderId}`, err)
      }
    }

    const totalCents = subtotalCents - discountCents + shippingCents + taxCents

    if (clientAmount !== totalCents) {
      console.warn(
        `create-payment-intent: amount mismatch for order ${orderId}: client=${clientAmount} server=${totalCents}`
      )
      return json({
        error: 'Your order total has changed since the page loaded. Please refresh the page and try again.',
        expectedAmount: totalCents,
      }, 409)
    }

    // Overwrite the client-written figures with the authoritative ones so
    // the order row, the charge and the webhook (which reads discount_code
    // and the tax calculation) all agree.
    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        items: items.map((item, i) => ({ ...item, price: lines[i].unitPrice })),
        subtotal_cents: subtotalCents,
        discount_cents: discountCents,
        discount_reason:
          discountSource === 'loyalty' ? 'Returning customer 10% loyalty discount' :
          discountSource === 'code' ? `Discount code ${validCode}` :
          null,
        discount_code: discountSource === 'code' ? validCode : null,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        stripe_tax_calculation_id: taxCalculationId,
        total_cents: totalCents,
      })
      .eq('id', orderId)

    if (updateError) {
      console.error(`create-payment-intent: failed to update order ${orderId}`, updateError)
      return json({ error: 'Could not prepare your order. Please try again.' }, 500)
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      metadata: {
        order_id: orderId,
        items: JSON.stringify(items.map(i => ({ productId: i.productId, quantity: i.quantity }))),
        // Stored so the webhook can call stripe.tax.transactions.createFromCalculation
        // after payment succeeds. Without this metadata, the calculation never
        // becomes a reportable tax transaction in Stripe's reports.
        tax_calculation_id: taxCalculationId || '',
      },
      receipt_email: email || undefined,
    })

    return json({ clientSecret: paymentIntent.client_secret }, 200)
  } catch (error) {
    console.error('create-payment-intent error:', error)
    return json({ error: error.message }, 400)
  }
})
