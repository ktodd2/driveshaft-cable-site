import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore, formatPrice, PRODUCT_PRICING, getPriceForQuantity, MIN_ORDER_QUANTITY, ORDER_QUANTITY_STEP } from '../stores/cartStore'
import { useInventory } from '../hooks/useInventory'
import InventoryProgressBar from '../components/common/InventoryProgressBar'
import SEOHead from '../components/common/SEOHead'

// For now, hardcoded product data - will come from Supabase later
const products = [
  {
    id: '1',
    name: 'Driveshaft Cable',
    slug: 'driveshaft-cable',
    short_description: 'Heavy-duty driveshaft safety cable for professional towing and recovery operations.',
    price_cents: PRODUCT_PRICING['1'].basePrice,
    sku: 'KTDC-001',
    specs: {
      cable_diameter: '5/32"',
      length: '1000mm (39")',
      working_load: '3000 lbs',
      material: 'Galvanized Steel',
      couplers: 'Aluminum'
    },
    images: ['/IMG_5493.jpeg'],
    image: '/IMG_5493.jpeg',
    in_stock: true
  },
  {
    id: '2',
    name: 'Driveshaft Cable +',
    slug: 'driveshaft-cable-plus',
    short_description: 'Reversed-coupler driveshaft cable for straight-line pull. Same 5/32" galvanized steel, 40" length, 3000 lb WLL.',
    price_cents: PRODUCT_PRICING['2'].basePrice,
    sku: 'KTDC-002',
    specs: {
      cable_diameter: '5/32"',
      length: '1000mm (40")',
      working_load: '3000 lbs',
      material: 'Galvanized Steel',
      couplers: 'Aluminum (reversed)'
    },
    images: ['/IMG_6707.jpeg'],
    image: '/IMG_6707.jpeg',
    in_stock: true
  }
]

function ProductCard({ product }) {
  const addItem = useCartStore((state) => state.addItem)
  const [quantity, setQuantity] = useState(MIN_ORDER_QUANTITY)
  // Draft string for the input so the user can clear it and type freely
  // without snapping to the minimum on every keystroke.
  const [quantityDraft, setQuantityDraft] = useState(String(MIN_ORDER_QUANTITY))
  const { stock, totalStock, loading: stockLoading } = useInventory(product.id)
  const outOfStock = !stockLoading && stock === 0

  const isLowStock = !stockLoading && stock !== null && stock > 0 && stock < MIN_ORDER_QUANTITY
  const effectiveMin = isLowStock ? stock : MIN_ORDER_QUANTITY
  const maxQty = stock !== null && stock > 0 ? stock : Infinity

  useEffect(() => {
    if (isLowStock) setQuantity(stock)
  }, [stock, stockLoading])

  useEffect(() => { setQuantityDraft(String(quantity)) }, [quantity])

  const handleAddToCart = () => {
    addItem(product, quantity, isLowStock ? { reducedMinimum: true } : {})
  }

  const handleQuantityChange = (delta) => {
    const newQty = Math.min(Math.max(effectiveMin, quantity + delta), maxQty)
    setQuantity(newQty)
  }

  const currentPrice = getPriceForQuantity(product.id, quantity)
  const totalPrice = currentPrice * quantity
  const basePrice = PRODUCT_PRICING[product.id]?.basePrice ?? product.price_cents

  return (
    <div className="bg-gray-800/50 border border-gray-700 hover:border-yellow-500 transition-all duration-300 group">
      {/* Product Image */}
      <Link to={`/products/${product.slug}`} className="block">
        <div className="aspect-square bg-gray-900 relative overflow-hidden">
          <img
            src={product.image || product.images?.[0] || '/IMG_5493.jpeg'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Stock Badge */}
          {!stockLoading && stock !== null && (
            <div className={`absolute top-3 right-3 px-3 py-1 text-xs font-bold ${
              stock === 0 ? 'bg-red-500 text-white' : stock <= 20 ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
            }`}>
              {stock === 0 ? 'OUT OF STOCK' : `${stock} in stock`}
            </div>
          )}
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
          {currentPrice < basePrice && (
            <div className="text-green-400 text-sm mt-1">Volume discount applied!</div>
          )}
        </div>

        {/* Inventory Progress Bar */}
        <InventoryProgressBar stock={stock} totalStock={totalStock} loading={stockLoading} />

        {/* Quantity Selector */}
        <div className="mb-4 mt-4">
          <label className="block text-gray-400 text-xs mb-2">Quantity (min. {effectiveMin}, in {ORDER_QUANTITY_STEP}s)</label>
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
                value={quantityDraft}
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
                className="w-20 text-center bg-transparent text-white border-x border-gray-700 py-2 text-sm"
                min={MIN_ORDER_QUANTITY}
                step={ORDER_QUANTITY_STEP}
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

        {/* Stock warnings */}
        {isLowStock && (
          <p className="text-yellow-500 text-xs mb-2">Only {stock} available — min order reduced from {MIN_ORDER_QUANTITY}</p>
        )}
        {!isLowStock && !outOfStock && stock !== null && quantity >= stock && (
          <p className="text-yellow-500 text-xs mb-2">Max available: {stock} units</p>
        )}

        {/* Add to Cart */}
        <button
          onClick={handleAddToCart}
          disabled={outOfStock || (!stockLoading && stock !== null && quantity > stock)}
          className={`w-full font-bold py-3 px-4 uppercase text-sm tracking-wider transition-colors ${
            outOfStock || (!stockLoading && stock !== null && quantity > stock)
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-yellow-500 hover:bg-yellow-400 text-black'
          }`}
        >
          {outOfStock ? 'Out of Stock' : `Add ${quantity} to Cart`}
        </button>
      </div>
    </div>
  )
}

function ProductListPage() {
  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title="Shop Driveshaft Safety Cables"
        description="Browse heavy-duty Driveshaft Cables (driveshaftcable). Two configurations — standard and reversed-coupler. Volume pricing from $2.90/unit. Free shipping on orders over $400."
        keywords="buy driveshaft cable, driveshaftcable, driveshaft cable price, bulk driveshaft cable, towing safety cable"
        canonical="/products"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Driveshaft Cables',
          itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://driveshaftcable.com/products/${p.slug}`,
            name: p.name
          }))
        }}
      />
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
              SHOP <span className="text-yellow-500">DRIVESHAFT CABLES</span>
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-white font-bold">Volume Pricing (per product)</h3>
                <div className="text-sm text-gray-300 space-y-1">
                  <div><span className="text-yellow-500">FREE SHIPPING</span> on orders over $400 · $15 flat rate under $400</div>
                  <div><span className="text-green-400">LOYALTY DISCOUNT</span> — returning customers get an extra 10% off!</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {Object.entries(PRODUCT_PRICING).map(([pid, pricing]) => (
                  <div key={pid} className="bg-black/20 border border-yellow-500/30 p-3">
                    <div className="text-xs uppercase tracking-wider text-yellow-500 font-bold mb-2">{pricing.name}</div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">10-49:</span>
                        <span className="text-yellow-500 font-bold">{formatPrice(pricing.basePrice)}/ea</span>
                      </div>
                      {pricing.tiers.slice().reverse().map((tier, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-gray-400">{tier.label}:</span>
                          <span className="text-green-400 font-bold">{formatPrice(tier.price)}/ea</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
