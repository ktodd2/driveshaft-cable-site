import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useCartStore, formatPrice, getPriceForQuantity, getTierPriceForQuantity, getActiveSaleForProduct, PRODUCT_PRICING, MIN_ORDER_QUANTITY, ORDER_QUANTITY_STEP } from '../stores/cartStore'
import SaleCountdown from '../components/common/SaleCountdown'
import { useInventory } from '../hooks/useInventory'
import { useStorefrontProduct } from '../hooks/useStorefrontProduct'
import InventoryProgressBar from '../components/common/InventoryProgressBar'
import SEOHead from '../components/common/SEOHead'

const SITE_ORIGIN = 'https://driveshaftcable.com'

// Image URLs in the DB might be relative ('/IMG_5489.jpeg') or absolute
// (Supabase Storage public URLs). For Schema.org we need absolute URLs.
function toAbsolute(url) {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${SITE_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

function formatDecimal(cents) {
  return ((cents || 0) / 100).toFixed(2)
}

// Build the Schema.org JSON-LD blob for the detail page from the DB row,
// so any new product the admin creates automatically gets sound SEO markup.
function buildStructuredData(product) {
  if (!product) return []
  const tiers = Array.isArray(product.tiers) ? product.tiers : []
  const lowest = tiers.length
    ? Math.min(product.base_price_cents, ...tiers.map(t => t.price))
    : product.base_price_cents
  const offerCount = 1 + tiers.length
  const productJson = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_description || (product.description || '').slice(0, 220),
    brand: { '@type': 'Brand', name: 'Driveshaft Cable' },
    sku: product.sku,
    mpn: product.sku,
    image: (product.images || []).map(toAbsolute),
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: formatDecimal(lowest),
      highPrice: formatDecimal(product.base_price_cents),
      priceCurrency: 'USD',
      offerCount: String(offerCount),
      availability: 'https://schema.org/InStock',
      url: `${SITE_ORIGIN}/products/${product.slug}`,
    },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE_ORIGIN}/products` },
      { '@type': 'ListItem', position: 3, name: product.name, item: `${SITE_ORIGIN}/products/${product.slug}` },
    ],
  }
  return [productJson, breadcrumb]
}

function ProductDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(MIN_ORDER_QUANTITY)
  // String state for the input so the user can clear and type freely.
  const [quantityDraft, setQuantityDraft] = useState(String(MIN_ORDER_QUANTITY))
  const [selectedImage, setSelectedImage] = useState(0)
  const addItem = useCartStore((state) => state.addItem)

  const { product, loading, notFound } = useStorefrontProduct(slug)
  const productImages = (product?.images && product.images.length > 0) ? product.images : []
  const { stock, totalStock, loading: stockLoading } = useInventory(product?.id)

  const isLowStock = !stockLoading && stock !== null && stock > 0 && stock < MIN_ORDER_QUANTITY
  const effectiveMin = isLowStock ? stock : MIN_ORDER_QUANTITY
  const maxQty = stock !== null && stock > 0 ? stock : Infinity

  useEffect(() => {
    if (isLowStock) setQuantity(stock)
  }, [stock, stockLoading])

  useEffect(() => { setQuantityDraft(String(quantity)) }, [quantity])

  // Re-render when sales reload / countdown expires.
  useCartStore(s => s.salesLoadedAt)
  const [, forceTick] = useState(0)

  if (loading) {
    return (
      <div className="pt-24 md:pt-32 min-h-screen flex items-center justify-center bg-ktodd-dark">
        <div className="text-yellow-500">Loading product…</div>
      </div>
    )
  }

  if (notFound || !product) {
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

  const productPricing = PRODUCT_PRICING[product.id] || PRODUCT_PRICING['1']
  const basePrice = productPricing.basePrice
  const productTiers = productPricing.tiers
  const currentPrice = getPriceForQuantity(product.id, quantity)
  const tierPrice    = getTierPriceForQuantity(product.id, quantity)
  const appliedSale  = getActiveSaleForProduct(product.id)
  const productStructuredData = buildStructuredData(product)
  const specsEntries = Object.entries(product.specs || {})
  const features     = Array.isArray(product.features) ? product.features : []
  const applications = Array.isArray(product.applications) ? product.applications : []

  const handleQuantityChange = (delta) => {
    const newQty = Math.min(Math.max(effectiveMin, quantity + delta), maxQty)
    setQuantity(newQty)
  }

  const cartProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price_cents: product.base_price_cents,
    sku: product.sku,
    images: product.images || [],
  }

  const handleAddToCart = () => {
    addItem(cartProduct, quantity, isLowStock ? { reducedMinimum: true } : {})
  }

  const handleBuyNow = () => {
    addItem(cartProduct, quantity, isLowStock ? { reducedMinimum: true } : {})
    navigate('/cart')
  }

  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title={`${product.name} — 3000lb WLL`}
        description={`${product.name} safety cable. ${product.short_description || ''} Starting at ${formatPrice(basePrice)}/unit with volume discounts.`}
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
                {productImages.length > 0 ? (
                  <img
                    src={productImages[Math.min(selectedImage, productImages.length - 1)]}
                    alt={`${product.name} - view ${selectedImage + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">No image</div>
                )}
              </div>
              {/* Thumbnails */}
              {productImages.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {productImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`flex-1 min-w-[80px] aspect-square overflow-hidden rounded border-2 transition-colors ${
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
              )}
            </div>

            {/* Product Info */}
            <div>
              <div className="mb-2">
                <span className="text-gray-400 text-sm">SKU: {product.sku}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-4">{product.name}</h1>

              <div className="flex items-center gap-4 mb-4 flex-wrap">
                {appliedSale ? (
                  <>
                    <span className="text-gray-500 line-through text-2xl">{formatPrice(tierPrice)}</span>
                    <span className="text-red-400 text-4xl font-industrial">{formatPrice(currentPrice)}</span>
                    <span className="text-red-400 text-xs font-bold bg-red-500/20 px-2 py-0.5 rounded">−{appliedSale.discount_percent}%</span>
                  </>
                ) : (
                  <span className="text-yellow-500 text-4xl font-industrial">{formatPrice(currentPrice)}</span>
                )}
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

              {appliedSale && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-400 px-3 py-2 mb-4 text-sm flex items-center gap-2 flex-wrap">
                  <span className="font-bold uppercase tracking-wider">{appliedSale.name}</span>
                  <span className="text-gray-500">·</span>
                  <span>Ends in </span>
                  <SaleCountdown
                    endsAt={appliedSale.ends_at}
                    className="font-mono font-bold"
                    onExpire={() => forceTick(t => t + 1)}
                  />
                </div>
              )}

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

              {product.description && (
                <p className="text-gray-300 mb-6 whitespace-pre-line">{product.description}</p>
              )}

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
                <label className="block text-gray-400 text-sm mb-2">Quantity (min. {effectiveMin}, in increments of {ORDER_QUANTITY_STEP})</label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-700">
                    <button
                      onClick={() => handleQuantityChange(-ORDER_QUANTITY_STEP)}
                      className="px-3 py-2 text-white hover:bg-gray-700 transition-colors text-sm font-bold"
                    >
                      -{ORDER_QUANTITY_STEP}
                    </button>
                    <input
                      type="number"
                      value={quantityDraft}
                      min={effectiveMin}
                      max={stock ?? undefined}
                      step={ORDER_QUANTITY_STEP}
                      onChange={(e) => setQuantityDraft(e.target.value)}
                      onBlur={() => {
                        const raw = parseInt(quantityDraft, 10)
                        const rounded = isLowStock
                          ? (isNaN(raw) ? effectiveMin : raw)
                          : Math.round((isNaN(raw) ? effectiveMin : raw) / ORDER_QUANTITY_STEP) * ORDER_QUANTITY_STEP
                        const clamped = Math.min(maxQty, Math.max(effectiveMin, rounded))
                        setQuantity(clamped)
                        setQuantityDraft(String(clamped))
                      }}
                      className="w-20 text-center bg-transparent text-white border-x border-gray-700 py-2"
                    />
                    <button
                      onClick={() => handleQuantityChange(ORDER_QUANTITY_STEP)}
                      className="px-3 py-2 text-white hover:bg-gray-700 transition-colors text-sm font-bold"
                    >
                      +{ORDER_QUANTITY_STEP}
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
              {specsEntries.length > 0 && (
                <div className="border-t border-gray-700 pt-6">
                  <h3 className="text-lg font-industrial text-yellow-500 mb-4">KEY SPECIFICATIONS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {specsEntries.slice(0, 4).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-gray-400 text-sm">{key}</div>
                        <div className="text-white font-bold">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Full Specs Section */}
      {specsEntries.length > 0 && (
        <section className="py-16 bg-ktodd-charcoal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-industrial text-white mb-8">
              TECHNICAL <span className="text-yellow-500">SPECIFICATIONS</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {specsEntries.map(([key, value]) => (
                <div key={key} className="bg-gray-800/50 border border-gray-700 p-4">
                  <div className="text-gray-400 text-sm uppercase tracking-wider mb-1">{key}</div>
                  <div className="text-yellow-500 text-xl font-industrial">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {features.length > 0 && (
        <section className="py-16 bg-ktodd-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-industrial text-white mb-8">
              WHY <span className="text-yellow-500">{product.name.toUpperCase()}?</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
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
      )}

      {/* Applications Section */}
      {applications.length > 0 && (
        <section className="py-16 bg-ktodd-charcoal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-industrial text-white mb-8">
              DESIGNED FOR <span className="text-yellow-500">HEAVY-DUTY APPLICATIONS</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {applications.map((app, index) => (
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
      )}
    </div>
  )
}

export default ProductDetailPage
