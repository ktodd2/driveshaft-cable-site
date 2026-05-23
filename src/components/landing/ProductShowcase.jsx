import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT_PRICING, formatPrice, getActiveSaleForProduct, useCartStore } from '../../stores/cartStore'
import { useStorefrontProducts } from '../../hooks/useStorefrontProducts'
import SaleCountdown from '../common/SaleCountdown'

function ProductShowcase() {
  // Re-render when sales reload / countdown expires.
  useCartStore(s => s.salesLoadedAt)
  const [, forceTick] = useState(0)

  const { products, loading } = useStorefrontProducts()

  // While the storefront query is in flight, render nothing rather than
  // a layout-thrashing placeholder. The list-page hero handles its own
  // loading state separately.
  if (loading && products.length === 0) return null
  if (products.length === 0) return null

  return (
    <section id="product" className="py-20 bg-gradient-to-b from-ktodd-dark to-green-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            {products.length === 1 ? (
              <>THE <span className="text-yellow-500">PRODUCT</span></>
            ) : products.length === 2 ? (
              <>TWO <span className="text-yellow-500">CONFIGURATIONS</span></>
            ) : (
              <>OUR <span className="text-yellow-500">LINEUP</span></>
            )}
          </h2>
          <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Same heavy-duty cable. Pick the coupler orientation that matches your driveline geometry.
          </p>
        </div>

        <div className={`grid gap-8 mb-12 ${products.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : products.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {products.map(product => {
            const pricing = PRODUCT_PRICING[product.id]
            const image = (product.images && product.images[0]) || '/IMG_5493.jpeg'
            const tagline = product.tagline || ''
            const bullets = Array.isArray(product.showcase_bullets) ? product.showcase_bullets : []
            const ctaLabel = product.cta_label || `Shop ${product.name}`
            return (
              <div key={product.id} className="bg-gray-800/50 border border-gray-700 hover:border-yellow-500 transition-colors duration-300 overflow-hidden flex flex-col">
                <Link to={`/products/${product.slug}`} className="block">
                  <div className="aspect-[4/3] bg-gray-900 overflow-hidden">
                    <img
                      src={image}
                      alt={`${product.name} — driveshaft safety cable`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                </Link>

                <div className="p-6 flex flex-col flex-grow">
                  <Link to={`/products/${product.slug}`}>
                    <h3 className="text-2xl font-industrial text-white hover:text-yellow-500 transition-colors mb-2">
                      {product.name}
                    </h3>
                  </Link>
                  {tagline && <p className="text-yellow-500 text-sm mb-4 font-medium">{tagline}</p>}

                  {bullets.length > 0 && (
                    <ul className="space-y-2 mb-6 flex-grow">
                      {bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {pricing && (() => {
                    const appliedSale = getActiveSaleForProduct(product.id)
                    const saleBase = appliedSale
                      ? Math.round(pricing.basePrice * (100 - appliedSale.discount_percent) / 100)
                      : null
                    return (
                      <>
                        <div className={`flex items-baseline justify-between ${appliedSale ? 'mb-2' : 'mb-4'}`}>
                          <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wider">Starting at</span>
                            {appliedSale ? (
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-gray-500 line-through text-lg">{formatPrice(pricing.basePrice)}</span>
                                <span className="text-red-400 text-2xl font-industrial">{formatPrice(saleBase)}<span className="text-gray-500 text-sm">/ea</span></span>
                                <span className="text-red-400 text-xs font-bold bg-red-500/20 px-2 py-0.5 rounded">−{appliedSale.discount_percent}%</span>
                              </div>
                            ) : (
                              <div className="text-yellow-500 text-2xl font-industrial">{formatPrice(pricing.basePrice)}<span className="text-gray-500 text-sm">/ea</span></div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 text-right">
                            Bulk: as low as<br/>
                            <span className="text-green-400 font-bold">{formatPrice(pricing.tiers[0].price)}/ea</span>
                          </div>
                        </div>
                        {appliedSale && (
                          <div className="text-red-400/90 text-xs mb-4 flex items-center gap-1.5">
                            <span className="font-bold uppercase tracking-wider">{appliedSale.name}</span>
                            <span className="text-gray-500">·</span>
                            <span>Ends in </span>
                            <SaleCountdown endsAt={appliedSale.ends_at} className="font-mono" onExpire={() => forceTick(t => t + 1)} />
                          </div>
                        )}
                      </>
                    )
                  })()}

                  <Link to={`/products/${product.slug}`} className="btn-primary w-full text-center">
                    {ctaLabel}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-4 bg-yellow-500/10 border border-yellow-500 text-center">
          <p className="text-yellow-500 font-industrial text-lg">
            ★ MADE BY A HEAVY DUTY OPERATOR FOR THE HEAVY DUTY OPERATOR
          </p>
        </div>
      </div>
    </section>
  )
}

export default ProductShowcase
