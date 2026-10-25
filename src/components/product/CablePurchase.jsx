import React from 'react'
import { Link } from 'react-router-dom'
import { formatPrice, MIN_ORDER_QUANTITY, SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../../stores/cartStore'
import { useStorefrontProducts } from '../../hooks/useStorefrontProducts'
import {
  CABLE_SLUGS,
  buildCableComparison,
  cableSelectionPricing,
  returningDiscountPercent,
  shippingForMerchandise,
} from '../../lib/cablePurchase'

// Rendered only on /products/driveshaft-cable and /products/driveshaft-cable-xl
// (ProductDetailPage gates on isCableSlug). No prices or rules live here.

const LENGTH_LINKS = [
  { slug: CABLE_SLUGS.standard, label: 'Standard' },
  { slug: CABLE_SLUGS.xl, label: 'XL' },
]

// Top-of-page positioning + direct links that work without any catalog fetch.
export function CablePositioning({ currentSlug }) {
  return (
    <div className="mb-4" data-testid="cable-positioning">
      <p className="text-gray-300 text-sm mb-2">
        Driveshaft cable for professional heavy-duty towing and recovery operations. Available in two lengths:
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose cable length">
        {LENGTH_LINKS.map(({ slug, label }) => {
          const current = slug === currentSlug
          return (
            <Link
              key={slug}
              to={`/products/${slug}`}
              aria-current={current ? 'page' : undefined}
              data-testid={`length-link-${slug}`}
              className={`text-sm font-bold px-4 py-1.5 border transition-colors ${current ? 'border-yellow-500 bg-yellow-500 text-black' : 'border-gray-600 text-gray-200 hover:border-yellow-500 hover:text-yellow-500'}`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// Selected-quantity total, shown directly above the purchase buttons.
export function CableOrderSummary({ selection, minQuantity, step }) {
  const { quantity, unitCents, tierUnitCents, sale, merchandiseCents } = selection
  const shipping = shippingForMerchandise(merchandiseCents)
  return (
    <div className="border border-gray-700 bg-gray-800/40 px-4 py-3 mb-4 text-sm" data-testid="cable-order-summary">
      <div className="text-gray-400" data-testid="cable-quantity-rule">
        Selected: <span className="text-white font-bold">{quantity}</span> cables · minimum {minQuantity}
        {step > 1 ? `, in increments of ${step}` : ''}
      </div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mt-1" aria-live="polite">
        <span className="text-gray-300" data-testid="cable-unit-line">
          {quantity} × {formatPrice(unitCents)}/ea
          {sale && <span className="text-gray-500"> (was {formatPrice(tierUnitCents)}/ea)</span>}
        </span>
        <span className="text-gray-300">
          Merchandise total: <span className="text-yellow-500 font-industrial text-2xl" data-testid="cable-merchandise-total">{formatPrice(merchandiseCents)}</span>
        </span>
      </div>
      {sale && (
        <p className="text-red-400 mt-1" data-testid="cable-sale-line">
          Includes {sale.name} (−{sale.percent}%), applied after volume pricing.
        </p>
      )}
      <p className="text-gray-400 mt-2" data-testid="cable-shipping-line">
        Shipping: {formatPrice(SHIPPING_FEE)} per order, free when the merchandise subtotal is {formatPrice(FREE_SHIPPING_THRESHOLD)} or more.{' '}
        {shipping.free
          ? 'This selection alone reaches free shipping.'
          : `On its own, this selection adds ${formatPrice(shipping.shippingCents)} shipping; ${formatPrice(shipping.remainingCents)} more merchandise reaches free shipping.`}
      </p>
      <p className="text-gray-500 mt-1" data-testid="cable-rules-line">
        Volume tier is set by this cable's quantity; the best active sale applies after it and is already included above.
        Shipping is judged on the cart's merchandise subtotal after volume and sale pricing, before any returning-customer or code discount. Tax is calculated at checkout.
      </p>
    </div>
  )
}

// Returning-customer explanation (replaces the generic note on cable pages).
export function CableReturningNote() {
  return (
    <div className="bg-green-500/10 border border-green-500/30 px-4 py-2 mb-6 text-sm text-green-400" data-testid="cable-returning-note">
      Returning customers save an extra <span className="font-bold">{returningDiscountPercent()}%</span> on the merchandise subtotal, applied automatically at checkout when
      the email has a paid order. Discount codes can't be combined with it; the larger discount applies.
    </div>
  )
}

export function CableComparison({ comparison, currentSlug }) {
  if (!comparison) return null
  const { entries } = comparison
  return (
    <section id="compare-lengths" className="py-12 bg-ktodd-dark border-t border-gray-800" data-testid="cable-comparison" aria-labelledby="compare-lengths-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="compare-lengths-heading" className="text-2xl font-industrial text-white mb-6">
          STANDARD <span className="text-yellow-500">VS XL</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {entries.map((entry) => {
            const current = entry.slug === currentSlug
            const min = entry.product.min_order_quantity ?? MIN_ORDER_QUANTITY
            const price = cableSelectionPricing(entry.product, min)
            return (
              <div key={entry.key} className={`border p-4 ${current ? 'border-yellow-500' : 'border-gray-700'}`} data-testid={`compare-card-${entry.slug}`}>
                <h3 className="text-lg font-industrial text-white mb-3">{entry.label} <span className="text-gray-400 text-sm font-sans">· {entry.product.name}</span></h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mb-4">
                  {entry.length && (<><dt className="text-gray-400">Length</dt><dd className="text-white">{entry.length}</dd></>)}
                  {entry.diameter && (<><dt className="text-gray-400">Cable diameter</dt><dd className="text-white">{entry.diameter}</dd></>)}
                  {entry.appearance && (<><dt className="text-gray-400">Build</dt><dd className="text-white">{entry.appearance}</dd></>)}
                  <dt className="text-gray-400">Price at {min}</dt>
                  <dd className="text-white">{formatPrice(price.unitCents)}/ea{price.sale ? ' (sale price)' : ''}</dd>
                </dl>
                <Link
                  to={entry.href}
                  aria-current={current ? 'page' : undefined}
                  data-testid={`compare-link-${entry.slug}`}
                  className={`inline-block text-center font-bold py-2 px-6 text-sm uppercase tracking-wider border-2 ${current ? 'border-yellow-500 bg-yellow-500 text-black' : 'border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black'}`}
                >
                  {current ? `Viewing ${entry.label}` : `Select ${entry.label}`}
                </Link>
              </div>
            )
          })}
        </div>
        <p className="text-gray-300 text-sm max-w-3xl" data-testid="cable-guidance">
          Choose by measurement: measure the distance the cable needs to cover on your own setup and pick the length that spans it.
          {' '}Lengths are as listed in each product's specifications; we don't list vehicle-specific fitment, so confirm by measuring.
          {' '}Not sure? <Link to="/contact" className="text-yellow-500 hover:text-yellow-400 underline">Contact us</Link>.
        </p>
      </div>
    </section>
  )
}

// Catalog-backed wrapper. useStorefrontProducts is the existing cached public
// catalog read; mounted only for the two cable slugs so other product pages
// make no extra request.
export function CableComparisonSection({ currentSlug }) {
  const { products } = useStorefrontProducts()
  return <CableComparison comparison={buildCableComparison(products)} currentSlug={currentSlug} />
}
