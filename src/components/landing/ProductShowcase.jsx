import React from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT_PRICING, formatPrice } from '../../stores/cartStore'

const PRODUCTS = [
  {
    id: '1',
    slug: 'driveshaft-cable',
    name: 'Driveshaft Cable',
    tagline: 'The original. Coupler positioned for angled pull paths.',
    image: '/inuse.jpeg',
    bullets: [
      'Crimped aluminum coupler in standard orientation',
      'Designed for the typical driveline geometry',
      '5/32" galvanized steel · 40" · 3000 lb WLL',
    ],
    ctaLabel: 'Shop Driveshaft Cable',
  },
  {
    id: '2',
    slug: 'driveshaft-cable-plus',
    name: 'Driveshaft Cable +',
    tagline: 'Coupler reversed — for straight-line pull when your geometry needs it.',
    image: '/IMG_6707.jpeg',
    bullets: [
      'Same heavy-duty cable, coupler turned around',
      'For applications that need a straight pull path',
      '5/32" galvanized steel · 40" · 3000 lb WLL',
    ],
    ctaLabel: 'Shop Driveshaft Cable +',
  },
]

function ProductShowcase() {
  return (
    <section id="product" className="py-20 bg-gradient-to-b from-ktodd-dark to-green-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            TWO <span className="text-yellow-500">CONFIGURATIONS</span>
          </h2>
          <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Same cable. Same breaking strength. Pick the coupler orientation that matches your driveline geometry.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {PRODUCTS.map(product => {
            const pricing = PRODUCT_PRICING[product.id]
            return (
              <div key={product.id} className="bg-gray-800/50 border border-gray-700 hover:border-yellow-500 transition-colors duration-300 overflow-hidden flex flex-col">
                <Link to={`/products/${product.slug}`} className="block">
                  <div className="aspect-[4/3] bg-gray-900 overflow-hidden">
                    <img
                      src={product.image}
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
                  <p className="text-yellow-500 text-sm mb-4 font-medium">{product.tagline}</p>

                  <ul className="space-y-2 mb-6 flex-grow">
                    {product.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                        <svg className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Starting at</span>
                      <div className="text-yellow-500 text-2xl font-industrial">{formatPrice(pricing.basePrice)}<span className="text-gray-500 text-sm">/ea</span></div>
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      Bulk: as low as<br/>
                      <span className="text-green-400 font-bold">{formatPrice(pricing.tiers[0].price)}/ea</span>
                    </div>
                  </div>

                  <Link to={`/products/${product.slug}`} className="btn-primary w-full text-center">
                    {product.ctaLabel}
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
