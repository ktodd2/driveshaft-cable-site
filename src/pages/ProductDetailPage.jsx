import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useCartStore, formatPrice, getPriceForQuantity, PRICE_PER_UNIT, PRICING_TIERS, MIN_ORDER_QUANTITY } from '../stores/cartStore'
import { useInventory } from '../hooks/useInventory'

const productImages = [
  '/inuse.jpeg',
  '/IMG_5491.jpeg',
  '/IMG_5492.jpeg',
  '/IMG_5493.jpeg',
  '/IMG_5490.jpeg',
  '/IMG_5489.jpeg',
]

// Hardcoded product data - will come from Supabase later
const products = {
  'driveshaft-cable': {
    id: '1',
    name: 'K.Todd Driveshaft Cable',
    slug: 'driveshaft-cable',
    description: `The K.Todd Driveshaft Cable is a purpose-built safety device designed to securely suspend disconnected driveshafts during towing and recovery operations.

Built with 5/32" galvanized steel cable and heavy-duty aluminum couplers, it provides a professional, single-use solution for keeping drivelines safely secured during transport. The cable is cut off after the job — no reuse, no guessing if it's still safe.

No more makeshift solutions with bungee cords, zip ties, or chains. The K.Todd Driveshaft Cable installs in seconds and keeps that shaft exactly where it needs to be.`,
    short_description: 'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
    price_cents: 300,
    bulk_threshold: 10,
    sku: 'KTDC-001',
    specs: {
      'Cable Diameter': '5/32" (4mm)',
      'Total Length': '1000mm (39")',
      'Working Load Limit': '3000 lbs',
      'Cable Material': 'Galvanized Steel Wire',
      'Coupler Material': 'Yellow Anodized Aluminum',
      'End Construction': 'Crimped Loops',
      'Weight': '1.2 lb'
    },
    applications: [
      'Class 7-8 Trucks',
      'Semi-Tractors',
      'Vocational Trucks',
      'Transit Buses',
      'Construction Equipment',
      'Agricultural Equipment',
      'Emergency Vehicles',
      'Military Vehicles'
    ],
    features: [
      { title: 'Prevents Driveshaft Drop', description: 'Secure suspension keeps the shaft in place during entire transport.' },
      { title: 'Protects Drivetrain Components', description: 'Eliminates seal damage and secondary transmission failures.' },
      { title: 'Faster Than Makeshift Solutions', description: 'No more chains, bungees, or zip ties. Install in seconds.' },
      { title: 'Compact & Field-Ready', description: 'Fits in glove box or tool tray. Always ready when you need it.' },
      { title: 'Reusable & Weather-Resistant', description: 'Built to last job after job in any conditions.' }
    ],
    in_stock: true
  }
}

function ProductDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const addItem = useCartStore((state) => state.addItem)

  const product = products[slug]
  const { stock, loading: stockLoading } = useInventory(product?.id)

  if (!product) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center bg-ktodd-dark">
        <div className="text-center">
          <h1 className="text-3xl font-industrial text-white mb-4">Product Not Found</h1>
          <Link to="/products" className="text-yellow-500 hover:text-yellow-400">
            ← Back to Products
          </Link>
        </div>
      </div>
    )
  }

  const handleQuantityChange = (delta) => {
    const newQty = Math.max(1, quantity + delta)
    setQuantity(newQty)
  }

  const handleAddToCart = () => {
    addItem(product, quantity)
    // Could show a toast notification here
  }

  const handleBuyNow = () => {
    addItem(product, quantity)
    navigate('/cart')
  }

  const currentPrice = getPriceForQuantity(quantity)

  return (
    <div className="pt-20">
      {/* Breadcrumb */}
      <div className="bg-ktodd-dark border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-gray-400 hover:text-yellow-500">Home</Link>
            <span className="text-gray-600">/</span>
            <Link to="/products" className="text-gray-400 hover:text-yellow-500">Products</Link>
            <span className="text-gray-600">/</span>
            <span className="text-yellow-500">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Section */}
      <section className="py-12 bg-ktodd-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Product Image Gallery */}
            <div className="flex flex-col gap-3">
              {/* Main Image */}
              <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-[4/3]">
                <img
                  src={productImages[selectedImage]}
                  alt={`${product.name} - view ${selectedImage + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Thumbnails */}
              <div className="flex gap-2">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`flex-1 aspect-square overflow-hidden rounded border-2 transition-colors ${
                      selectedImage === idx ? 'border-yellow-500' : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div>
              <div className="mb-2">
                <span className="text-gray-400 text-sm">SKU: {product.sku}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-4">{product.name}</h1>

              <div className="flex items-center gap-4 mb-4">
                <span className="text-yellow-500 text-4xl font-industrial">{formatPrice(currentPrice)}</span>
                <span className="text-gray-400 text-sm">per unit</span>
                {stockLoading ? (
                  <span className="bg-gray-500/20 text-gray-400 px-3 py-1 text-sm">Checking stock...</span>
                ) : stock === null ? (
                  <span className="bg-gray-500/20 text-gray-400 px-3 py-1 text-sm">Stock unavailable</span>
                ) : stock === 0 ? (
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 text-sm">Out of Stock</span>
                ) : stock <= 20 ? (
                  <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 text-sm">{stock} units left</span>
                ) : (
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 text-sm">{stock} units in stock</span>
                )}
              </div>

              {/* Volume Pricing Tiers */}
              <div className="flex flex-wrap gap-3 mb-6">
                <span className={`text-xs px-3 py-1 border ${currentPrice === PRICE_PER_UNIT ? 'border-yellow-500 text-yellow-500' : 'border-gray-700 text-gray-500'}`}>
                  10-49: {formatPrice(PRICE_PER_UNIT)}/ea
                </span>
                {PRICING_TIERS.slice().reverse().map((tier, i) => (
                  <span key={i} className={`text-xs px-3 py-1 border ${currentPrice === tier.price ? 'border-green-500 text-green-400' : 'border-gray-700 text-gray-500'}`}>
                    {tier.label}: {formatPrice(tier.price)}/ea
                  </span>
                ))}
              </div>

              {/* Loyalty Discount Note */}
              <div className="bg-green-500/10 border border-green-500/30 px-4 py-2 mb-6 text-sm text-green-400">
                Returning customers save an extra <span className="font-bold">10%</span> — applied automatically at checkout!
              </div>

              <p className="text-gray-300 mb-8 whitespace-pre-line">{product.description}</p>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm mb-2">Quantity</label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-700">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      className="px-4 py-2 text-white hover:bg-gray-700 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 text-center bg-transparent text-white border-x border-gray-700 py-2"
                    />
                    <button
                      onClick={() => handleQuantityChange(1)}
                      className="px-4 py-2 text-white hover:bg-gray-700 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-gray-400">
                    Total: <span className="text-yellow-500 font-bold">{formatPrice(currentPrice * quantity)}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                {stock === 0 ? (
                  <div className="flex-1 text-center border-2 border-gray-600 text-gray-500 font-bold py-3 px-8 uppercase tracking-wider font-industrial cursor-not-allowed">
                    Out of Stock
                  </div>
                ) : (
                  <>
                    <button onClick={handleAddToCart} className="flex-1 border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial">
                      Add to Cart
                    </button>
                    <button onClick={handleBuyNow} className="btn-primary flex-1">
                      Buy Now
                    </button>
                  </>
                )}
              </div>

              {/* Quick Specs */}
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-lg font-industrial text-yellow-500 mb-4">KEY SPECIFICATIONS</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(product.specs).slice(0, 4).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-gray-400 text-sm">{key}</div>
                      <div className="text-white font-bold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full Specs Section */}
      <section className="py-16 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-industrial text-white mb-8">
            TECHNICAL <span className="text-yellow-500">SPECIFICATIONS</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className="bg-gray-800/50 border border-gray-700 p-4">
                <div className="text-gray-400 text-sm uppercase tracking-wider mb-1">{key}</div>
                <div className="text-yellow-500 text-xl font-industrial">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-ktodd-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-industrial text-white mb-8">
            WHY <span className="text-yellow-500">K.TODD?</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {product.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-800/30 border-l-4 border-yellow-500">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">{feature.title}</h4>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Applications Section */}
      <section className="py-16 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-industrial text-white mb-8">
            DESIGNED FOR <span className="text-yellow-500">HEAVY-DUTY APPLICATIONS</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {product.applications.map((app, index) => (
              <div key={index} className="flex items-center gap-3 bg-gray-800/30 px-4 py-3 border-l-2 border-yellow-500">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-300">{app}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default ProductDetailPage
