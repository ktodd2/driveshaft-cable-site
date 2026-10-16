// Stripe Tax calculation shared by calculate-tax (the checkout quote) and
// create-payment-intent (the authoritative total that is actually charged).

import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

// txcd_99999999 = "General — Tangible Goods", Stripe's catch-all for physical
// products. If a more specific code for automotive parts is added to the
// Stripe Dashboard later, update this constant.
const PRODUCT_TAX_CODE = 'txcd_99999999'
const SHIPPING_TAX_CODE = 'txcd_92010001' // "Shipping" — taxability varies by state, Stripe handles it

export interface ShippingAddress {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export interface PricedLine {
  productId: string
  quantity: number
  unitPrice: number
}

export function isAddressTaxable(addr: ShippingAddress | undefined): boolean {
  // Stripe Tax needs at minimum a postal code + country to determine
  // jurisdiction. Without those it cannot return a meaningful rate.
  if (!addr) return false
  if (!addr.country) return false
  if (!addr.postal_code || addr.postal_code.trim().length < 5) return false
  return true
}

export async function createTaxCalculation(
  stripe: Stripe,
  lines: PricedLine[],
  subtotalCents: number,
  shippingCents: number,
  discountCents: number,
  address: ShippingAddress,
): Promise<{ taxCents: number; calculationId: string }> {
  // Apply the discount proportionally across line items. Tax is calculated on
  // the post-discount amount because most US jurisdictions tax the net price
  // the customer actually pays.
  const safeDiscount = Math.max(0, Math.min(discountCents, subtotalCents))
  const discountRatio = subtotalCents > 0 ? safeDiscount / subtotalCents : 0

  const lineItems = lines.map((line) => {
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
        line1: address.line1 || '',
        line2: address.line2 || undefined,
        city: address.city || '',
        state: address.state || '',
        postal_code: address.postal_code,
        country: address.country || 'US',
      },
      address_source: 'shipping',
    },
    shipping_cost: shippingCents > 0
      ? { amount: shippingCents, tax_code: SHIPPING_TAX_CODE, tax_behavior: 'exclusive' }
      : undefined,
    expand: ['line_items.data'],
  })

  return { taxCents: calculation.tax_amount_exclusive, calculationId: calculation.id }
}
