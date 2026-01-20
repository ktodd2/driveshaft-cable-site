import React from 'react'
import { Link } from 'react-router-dom'
import { useCartStore, formatPrice } from '../stores/cartStore'

// For now, hardcoded product data - will come from Supabase later
const products = [
  {
    id: '1',
    name: 'K.Todd Driveshaft Cable',
    slug: 'driveshaft-cable',
    short_description: 'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
    price_cents: 7999, // $79.99
    sku: 'KTDC-001',
    specs: {
      cable_diameter: '5/32"',
      length: '1000mm (39")',
      working_load: '2400 lb',
      material: 'Galvanized Steel',
      couplers: 'Aluminum'
    },
    images: ['/product-image.jpg'],
    in_stock: true
  }
]

function ProductCard({ product }) {
  const addItem = useCartStore((state) => state.addItem)

  const handleAddToCart = () => {
    addItem(product, 1)
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 hover:border-yellow-500 transition-all duration-300 group">
      {/* Product Image */}
      <Link to={`/products/${product.slug}`} className="block">
        <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 p-8 relative overflow-hidden">
          {/* SVG Illustration */}
          <svg viewBox="0 0 400 300" className="w-full h-full">
            <defs>
              <linearGradient id="cableGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6B7280" />
                <stop offset="50%" stopColor="#9CA3AF" />
                <stop offset="100%" stopColor="#6B7280" />
              </linearGradient>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFD700" />
                <stop offset="50%" stopColor="#D4A017" />
                <stop offset="100%" stopColor="#B8860B" />
              </linearGradient>
            </defs>
            <path d="M 80 150 Q 200 100 320 150" stroke="url(#cableGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
            <rect x="50" y="130" width="45" height="40" rx="4" fill="url(#goldGrad)" />
            <ellipse cx="72" cy="150" rx="10" ry="8" fill="#1A1A1A" />
            <rect x="305" y="130" width="45" height="40" rx="4" fill="url(#goldGrad)" />
            <ellipse cx="328" cy="150" rx="10" ry="8" fill="#1A1A1A" />
          </svg>

          {/* Made in USA badge */}
          <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 font-industrial text-xs">
            MADE IN USA
          </div>
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-6">
        <Link to={`/products/${product.slug}`}>
          <h3 className="text-xl font-industrial text-white mb-2 group-hover:text-yellow-500 transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-gray-400 text-sm mb-4">{product.short_description}</p>

        {/* Specs preview */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1">{product.specs.cable_diameter} Cable</span>
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1">{product.specs.length}</span>
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1">{product.specs.working_load} WLL</span>
        </div>

        {/* Price & Add to Cart */}
        <div className="flex items-center justify-between">
          <div className="text-yellow-500 text-2xl font-industrial">
            {formatPrice(product.price_cents)}
          </div>
          <button
            onClick={handleAddToCart}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 uppercase text-sm tracking-wider transition-colors"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductListPage() {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
              SHOP <span className="text-yellow-500">PRODUCTS</span>
            </h1>
            <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Professional-grade equipment for heavy-duty towing and recovery operations.
            </p>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Bulk Order Banner */}
          <div className="bg-yellow-500/10 border border-yellow-500 p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-white">
                <span className="font-bold">Ordering 10+ units?</span> Get volume pricing with a custom quote.
              </span>
            </div>
            <Link to="/quote" className="text-yellow-500 hover:text-yellow-400 font-bold whitespace-nowrap">
              Request Quote →
            </Link>
          </div>

          {/* Products */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* More products coming */}
          <div className="mt-16 text-center">
            <div className="inline-block bg-gray-800/50 border border-gray-700 px-8 py-6">
              <p className="text-gray-400 mb-2">More products coming soon</p>
              <p className="text-white font-industrial">DRIVELINE ACCESSORIES & SAFETY EQUIPMENT</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ProductListPage
