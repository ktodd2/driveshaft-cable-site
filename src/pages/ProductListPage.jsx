import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore, formatPrice, PRICE_PER_UNIT, BULK_PRICE_PER_UNIT, BULK_THRESHOLD, MIN_ORDER_QUANTITY } from '../stores/cartStore'

// For now, hardcoded product data - will come from Supabase later
const products = [
  {
    id: '1',
    name: 'K.Todd Driveshaft Cable',
    slug: 'driveshaft-cable',
    short_description: 'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
    price_cents: PRICE_PER_UNIT, // $4.00 per unit
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
  const [quantity, setQuantity] = useState(MIN_ORDER_QUANTITY)

  const handleAddToCart = () => {
    addItem(product, quantity)
  }

  const handleQuantityChange = (delta) => {
    const newQty = Math.max(MIN_ORDER_QUANTITY, quantity + delta)
    setQuantity(newQty)
  }

  const currentPrice = quantity >= BULK_THRESHOLD ? BULK_PRICE_PER_UNIT : PRICE_PER_UNIT
  const totalPrice = currentPrice * quantity

  return (
    <div className="bg-gray-800/50 border border-gray-700 hover:border-yellow-500 transition-all duration-300 group">
      {/* Product Image */}
      <Link to={`/products/${product.slug}`} className="block">
        <div className="aspect-square bg-gray-900 relative overflow-hidden">
          <img
            src="/IMG_5493.jpeg"
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
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

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-yellow-500 text-2xl font-industrial">{formatPrice(currentPrice)}</span>
            <span className="text-gray-400 text-sm">per unit</span>
          </div>
          {quantity >= BULK_THRESHOLD && (
            <div className="text-green-400 text-sm mt-1">Bulk discount applied!</div>
          )}
        </div>

        {/* Quantity Selector */}
        <div className="mb-4">
          <label className="block text-gray-400 text-xs mb-2">Quantity (min. {MIN_ORDER_QUANTITY})</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-gray-700">
              <button
                onClick={() => handleQuantityChange(-10)}
                className="px-3 py-2 text-white hover:bg-gray-700 transition-colors text-sm"
              >
                -10
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(MIN_ORDER_QUANTITY, parseInt(e.target.value) || MIN_ORDER_QUANTITY))}
                className="w-16 text-center bg-transparent text-white border-x border-gray-700 py-2 text-sm"
                min={MIN_ORDER_QUANTITY}
              />
              <button
                onClick={() => handleQuantityChange(10)}
                className="px-3 py-2 text-white hover:bg-gray-700 transition-colors text-sm"
              >
                +10
              </button>
            </div>
            <span className="text-gray-400 text-sm">
              Total: <span className="text-yellow-500 font-bold">{formatPrice(totalPrice)}</span>
            </span>
          </div>
        </div>

        {/* Add to Cart */}
        <button
          onClick={handleAddToCart}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-4 uppercase text-sm tracking-wider transition-colors"
        >
          Add {quantity} to Cart
        </button>
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
          {/* Pricing Info Banner */}
          <div className="bg-yellow-500/10 border border-yellow-500 p-4 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-white font-bold mb-2">Volume Pricing</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">10-49 units:</span>
                    <span className="text-yellow-500 font-bold">{formatPrice(PRICE_PER_UNIT)}/ea</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">50+ units:</span>
                    <span className="text-green-400 font-bold">{formatPrice(BULK_PRICE_PER_UNIT)}/ea</span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-300">
                <span className="text-yellow-500">FREE SHIPPING</span> on all orders
              </div>
            </div>
          </div>

          {/* Minimum Order Notice */}
          <div className="bg-gray-800/50 border border-gray-700 p-4 mb-8 flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-300">
              Minimum order: <span className="text-white font-bold">{MIN_ORDER_QUANTITY} units</span>
            </span>
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
