import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useCartStore, formatPrice, getPriceForQuantity, PRODUCT_PRICING, MIN_ORDER_QUANTITY } from '../stores/cartStore'
import { useInventory } from '../hooks/useInventory'
import InventoryProgressBar from '../components/common/InventoryProgressBar'
import SEOHead from '../components/common/SEOHead'

const structuredDataBySlug = {
  'driveshaft-cable': [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Driveshaft Cable',
      description: 'Driveshaft Safety Cable (driveshaftcable). 3000lb working load limit, 5/32" galvanized steel, 39" length, aluminum couplers. Purpose-built for heavy-duty towing and recovery operations.',
      brand: { '@type': 'Brand', name: 'Driveshaft Cable' },
      sku: 'KTDC-001',
      mpn: 'KTDC-001',
      image: [
        'https://driveshaftcable.com/IMG_5489.jpeg',
        'https://driveshaftcable.com/inuse.jpeg',
        'https://driveshaftcable.com/IMG_5491.jpeg',
        'https://driveshaftcable.com/IMG_5492.jpeg'
      ],
      material: 'Galvanized Steel Wire with Aluminum Couplers',
      weight: { '@type': 'QuantitativeValue', value: '1.2', unitCode: 'LBR' },
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '2.90',
        highPrice: '3.45',
        priceCurrency: 'USD',
        offerCount: '4',
        availability: 'https://schema.org/InStock',
        url: 'https://driveshaftcable.com/products/driveshaft-cable'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://driveshaftcable.com/' },
        { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://driveshaftcable.com/products' },
        { '@type': 'ListItem', position: 3, name: 'Driveshaft Cable', item: 'https://driveshaftcable.com/products/driveshaft-cable' }
      ]
    }
  ],
  'driveshaft-cable-plus': [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Driveshaft Cable +',
      description: 'Driveshaft Cable + — reversed coupler configuration for straight-line pull. 3000lb working load limit, 5/32" galvanized steel, 40" length, aluminum couplers. Same heavy-duty safety cable with the coupler turned around so it can pull in a straight line.',
      brand: { '@type': 'Brand', name: 'Driveshaft Cable' },
      sku: 'KTDC-002',
      mpn: 'KTDC-002',
      image: [
        'https://driveshaftcable.com/IMG_6707.jpeg',
        'https://driveshaftcable.com/IMG_6708.jpeg'
      ],
      material: 'Galvanized Steel Wire with Aluminum Couplers',
      weight: { '@type': 'QuantitativeValue', value: '1.2', unitCode: 'LBR' },
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '3.40',
        highPrice: '3.95',
        priceCurrency: 'USD',
        offerCount: '4',
        availability: 'https://schema.org/InStock',
        url: 'https://driveshaftcable.com/products/driveshaft-cable-plus'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://driveshaftcable.com/' },
        { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://driveshaftcable.com/products' },
        { '@type': 'ListItem', position: 3, name: 'Driveshaft Cable +', item: 'https://driveshaftcable.com/products/driveshaft-cable-plus' }
      ]
    }
  ]
}

const productImagesBySlug = {
  'driveshaft-cable': [
    '/inuse.jpeg',
    '/IMG_5491.jpeg',
    '/IMG_5492.jpeg',
    '/IMG_5493.jpeg',
    '/IMG_5490.jpeg',
    '/IMG_5489.jpeg',
  ],
  'driveshaft-cable-plus': [
    '/IMG_6707.jpeg',
    '/IMG_6708.jpeg',
  ]
}

// Hardcoded product data - will come from Supabase later
const products = {
  'driveshaft-cable': {
    id: '1',
    name: 'Driveshaft Cable',
    slug: 'driveshaft-cable',
    description: `The Driveshaft Cable is a purpose-built safety device designed to securely suspend disconnected driveshafts during towing and recovery operations.

Built with 5/32" galvanized steel cable and heavy-duty aluminum couplers, it provides a professional, single-use solution for keeping drivelines safely secured during transport. The cable is cut off after the job — no reuse, no guessing if it's still safe.

No more makeshift solutions with bungee cords, zip ties, or chains. The Driveshaft Cable installs in seconds and keeps that shaft exactly where it needs to be.`,
    short_description: 'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
    price_cents: PRODUCT_PRICING['1'].basePrice,
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
      { title: 'Single-Use by Design', description: 'Cut off after each job — no reuse, no guessing if it\'s still safe.' }
    ],
    in_stock: true
  },
  'driveshaft-cable-plus': {
    id: '2',
    name: 'Driveshaft Cable +',
    slug: 'driveshaft-cable-plus',
    description: `Driveshaft Cable + is the same heavy-duty driveshaft safety cable as our original, but with the red coupler reversed so it can pull in a straight line. When your driveline geometry needs a straight pull path instead of an angled one, this is the configuration you want.

Built with the same 5/32" galvanized steel cable and the same crimped aluminum coupler — just turned around. Same 40" length. Same 3000 lb working load limit. Same single-use, cut-it-off-after-the-job design.

If you've used the original Driveshaft Cable and wished the coupler faced the other way for your specific application, this is for you.`,
    short_description: 'Reversed-coupler driveshaft cable for straight-line pull.',
    price_cents: PRODUCT_PRICING['2'].basePrice,
    bulk_threshold: 10,
    sku: 'KTDC-002',
    specs: {
      'Cable Diameter': '5/32" (4mm)',
      'Total Length': '1000mm (40")',
      'Working Load Limit': '3000 lbs',
      'Cable Material': 'Galvanized Steel Wire',
      'Coupler Material': 'Anodized Aluminum (Reversed)',
      'Coupler Orientation': 'Reversed — for straight-line pull',
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
      { title: 'Straight-Line Pull', description: 'Reversed coupler lets the cable pull in a straight line — ideal when geometry calls for it.' },
      { title: 'Same Heavy-Duty Build', description: 'Identical 5/32" galvanized steel cable and 3000 lb WLL as the original.' },
      { title: 'Prevents Driveshaft Drop', description: 'Secure suspension keeps the shaft in place during entire transport.' },
      { title: 'Faster Than Makeshift Solutions', description: 'No more chains, bungees, or zip ties. Install in seconds.' },
      { title: 'Single-Use by Design', description: 'Cut off after each job — no reuse, no guessing if it\'s still safe.' }
    ],
    in_stock: true
  }
}

function ProductDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(MIN_ORDER_QUANTITY)
  const [selectedImage, setSelectedImage] = useState(0)
  const addItem = useCartStore((state) => state.addItem)

  const product = products[slug]
  const productImages = productImagesBySlug[slug] || []
  const productStructuredData = structuredDataBySlug[slug] || []
  const { stock, totalStock, loading: stockLoading } = useInventory(product?.id)

  const isLowStock = !stockLoading && stock !== null && stock > 0 && stock < MIN_ORDER_QUANTITY
  const effectiveMin = isLowStock ? stock : MIN_ORDER_QUANTITY
  const maxQty = stock !== null && stock > 0 ? stock : Infinity

  useEffect(() => {
    if (isLowStock) setQuantity(stock)
  }, [stock, stockLoading])

  if (!product) {
    return (
      <div className="pt-24 md:pt-32 min-h-screen flex items-center justify-center bg-ktodd-dark">
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
    const newQty = Math.min(Math.max(effectiveMin, quantity + delta), maxQty)
    setQuantity(newQty)
  }

  const handleAddToCart = () => {
    addItem(product, quantity, isLowStock ? { reducedMinimum: true } : {})
  }

  const handleBuyNow = () => {
    addItem(product, quantity, isLowStock ? { reducedMinimum: true } : {})
    navigate('/cart')
  }

  const currentPrice = getPriceForQuantity(product.id, quantity)
  const productPricing = PRODUCT_PRICING[product.id] || PRODUCT_PRICING['1']
  const basePrice = productPricing.basePrice
  const productTiers = productPricing.tiers

  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title={`${product.name} — 3000lb WLL`}
        description={`${product.name} safety cable. 3000lb working load limit, 5/32" galvanized steel, aluminum couplers. Starting at ${formatPrice(basePrice)}/unit with volume discounts.`}
        keywords="driveshaft cable, driveshaftcable, 3000lb WLL cable, towing safety cable, driveshaft guard"
        canonical={`/products/${product.slug}`}
        structuredData={productStructuredData}
      />
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
                      loading="lazy"
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

              {/* Inventory Progress Bar */}
              <InventoryProgressBar stock={stock} totalStock={totalStock} loading={stockLoading} />

              {/* Volume Pricing Tiers */}
              <div className="flex flex-wrap gap-3 mb-6 mt-6">
                <span className={`text-xs px-3 py-1 border ${currentPrice === basePrice ? 'border-yellow-500 text-yellow-500' : 'border-gray-700 text-gray-500'}`}>
                  10-49: {formatPrice(basePrice)}/ea
                </span>
                {productTiers.slice().reverse().map((tier, i) => (
                  <span key={i} className={`text-xs px-3 py-1 border ${currentPrice === tier.price ? 'border-green-500 text-green-400' : 'border-gray-700 text-gray-500'}`}>
                    {tier.label}: {formatPrice(tier.price)}/ea
                  </span>
                ))}
              </div>

              {/* Loyalty Discount Note */}
              <div className="bg-green-500/10 border border-green-500/30 px-4 py-2 mb-6 text-sm text-green-400">
                Returning customers save an extra <span className="font-bold">10%</span> — applied automatically at checkout!
              </div>

              <p className="text-gray-300 mb-6 whitespace-pre-line">{product.description}</p>

              {/* Single-Use Notice */}
              <div className="bg-yellow-500/10 border border-yellow-500/40 px-4 py-3 mb-8 flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="text-yellow-500 font-bold text-sm uppercase tracking-wider">Single-Use Product</span>
                  <p className="text-gray-300 text-sm mt-1">This cable is designed to be cut off after each job. One cable per use — no reuse, no risk.</p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm mb-2">Quantity (min. {effectiveMin})</label>
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
                      min={effectiveMin}
                      max={stock ?? undefined}
                      onChange={(e) => {
                        setQuantity(Math.min(maxQty, Math.max(effectiveMin, parseInt(e.target.value) || effectiveMin)))
                      }}
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
                {isLowStock && (
                  <p className="text-yellow-500 text-sm mt-2">Only {stock} available — min order reduced from {MIN_ORDER_QUANTITY}</p>
                )}
                {!isLowStock && stock !== null && quantity >= stock && stock > 0 && (
                  <p className="text-yellow-500 text-sm mt-2">Maximum available: {stock} units</p>
                )}
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
            WHY <span className="text-yellow-500">{product.name.toUpperCase()}?</span>
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
