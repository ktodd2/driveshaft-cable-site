import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  useCartStore, formatPrice, PRODUCT_PRICING,
  getPriceForQuantity, getTierPriceForQuantity, getActiveSaleForProduct,
  MIN_ORDER_QUANTITY, ORDER_QUANTITY_STEP,
  getMinForProduct, getStepForProduct,
} from '../../stores/cartStore'
import SaleCountdown from '../common/SaleCountdown'
import { useInventory } from '../../hooks/useInventory'
import { useStorefrontProducts } from '../../hooks/useStorefrontProducts'
import InventoryProgressBar from '../common/InventoryProgressBar'

// Pick the three spec chips we want to highlight on the card. The first
// three values in product.specs would be brittle because Postgres JSONB
// doesn't guarantee insertion order — we kept seeing the "1.2 lb" Weight
// spec sneak into the chip row instead of the WLL. Look up by recognized
// label, prefix WLL since "3000 lbs" alone doesn't read clearly. Falls
// back to first-three for products that don't have these specific keys.
function topSpecChips(specs) {
  if (!specs || typeof specs !== 'object') return []
  const find = (re) => {
    for (const [key, value] of Object.entries(specs)) {
      if (re.test(key)) return { key, value }
    }
    return null
  }
  const diameter = find(/cable.?diameter|^diameter$/i)
  const length   = find(/total.?length|^length$/i)
  const wll      = find(/working.?load.?limit|^wll$/i)

  const chips = []
  if (diameter) chips.push({ key: diameter.key, label: '',    value: diameter.value })
  if (length)   chips.push({ key: length.key,   label: '',    value: length.value })
  if (wll)      chips.push({ key: wll.key,      label: 'WLL ',value: wll.value })

  if (chips.length < 3) {
    const seen = new Set(chips.map(c => c.key))
    for (const [key, value] of Object.entries(specs)) {
      if (seen.has(key) || chips.length >= 3) continue
      chips.push({ key, label: '', value })
    }
  }
  return chips
}

function ProductCard({ product }) {
  const addItem = useCartStore((state) => state.addItem)
  const productMin = product.min_order_quantity ?? MIN_ORDER_QUANTITY
  const productStep = product.order_quantity_step ?? ORDER_QUANTITY_STEP
  const [quantity, setQuantity] = useState(productMin)
  // Draft string for the input so the user can clear it and type freely
  // without snapping to the minimum on every keystroke.
  const [quantityDraft, setQuantityDraft] = useState(String(productMin))
  const { stock, totalStock, loading: stockLoading } = useInventory(product.id)
  const outOfStock = !stockLoading && stock === 0

  const isLowStock = !stockLoading && stock !== null && stock > 0 && stock < productMin
  const effectiveMin = isLowStock ? stock : productMin
  const maxQty = stock !== null && stock > 0 ? stock : Infinity

  useEffect(() => {
    if (isLowStock) setQuantity(stock)
  }, [stock, stockLoading])

  useEffect(() => { setQuantityDraft(String(quantity)) }, [quantity])

  const handleAddToCart = () => {
    // The cart store expects `price_cents` and `images` on the product
    // object; DB row uses `base_price_cents`. Normalize at the call site.
    addItem(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price_cents: product.base_price_cents,
        sku: product.sku,
        images: product.images || [],
      },
      quantity,
      isLowStock ? { reducedMinimum: true } : {}
    )
  }

  const handleQuantityChange = (delta) => {
    const newQty = Math.min(Math.max(effectiveMin, quantity + delta), maxQty)
    setQuantity(newQty)
  }

  // Re-render when sales reload or a countdown expires.
  useCartStore(s => s.salesLoadedAt)
  const [, forceTick] = useState(0)

  const currentPrice = getPriceForQuantity(product.id, quantity)
  const tierPrice    = getTierPriceForQuantity(product.id, quantity)
  const totalPrice   = currentPrice * quantity
  const basePrice    = PRODUCT_PRICING[product.id]?.basePrice ?? product.base_price_cents
  const appliedSale  = getActiveSaleForProduct(product.id)

  const thumbnail = (product.images && product.images[0]) || '/IMG_5493.jpeg'
  const chips = topSpecChips(product.specs)

  return (
    <article className={`flex flex-col bg-gray-900 rounded-2xl overflow-hidden ring-1 ring-gray-700 shadow-[0_24px_48px_-32px_#000] transition-shadow duration-200 group ${
      outOfStock ? '' : 'hover:ring-yellow-500/60'
    }`}>
      {/* Product Image */}
      <Link to={`/products/${product.slug}`} className="block">
        <div className="aspect-[4/3] bg-black relative overflow-hidden">
          <img
            src={thumbnail}
            alt={product.name}
            className={`w-full h-full object-cover outline outline-1 -outline-offset-1 outline-white/10 ${outOfStock ? 'grayscale' : ''}`}
            loading="lazy"
          />
          {/* Stock Badge */}
          {!stockLoading && stock !== null && (
            <div className={`absolute top-3 right-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-industrial tracking-[0.1em] uppercase tabular-nums bg-black/75 backdrop-blur-sm ring-1 ring-inset ${
              stock === 0 ? 'text-red-300 ring-red-400/60' : stock <= 20 ? 'text-yellow-400 ring-yellow-500/60' : 'text-green-400 ring-green-400/60'
            }`}>
              <span className="w-2 h-2 rounded-full bg-current" aria-hidden="true" />
              {stock === 0 ? 'OUT OF STOCK' : `${stock} in stock`}
            </div>
          )}
          {/* Big diagonal "SOLD OUT" overlay so the eye actively skips this card */}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/80 text-red-300 font-industrial text-2xl tracking-[0.2em] px-6 py-2 rounded-lg ring-1 ring-inset ring-red-400/60">
                SOLD OUT
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-6 flex flex-col flex-1">
        <Link to={`/products/${product.slug}`} className="rounded">
          <h3 className={`text-2xl font-industrial mb-2 transition-colors ${
            outOfStock
              ? 'text-gray-200'
              : 'text-white group-hover:text-yellow-500'
          }`}>
            {product.name}
          </h3>
        </Link>
        <p className="text-gray-400 text-sm mb-4">{product.short_description}</p>

        {/* Specs preview — Cable Diameter, Length, then "WLL <value>". */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {chips.map(c => (
              <span key={c.key} className="text-xs bg-gray-800 ring-1 ring-inset ring-gray-700 text-gray-200 px-2.5 py-1 rounded-md tabular-nums">
                {c.label}{c.value}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mb-4">
          {appliedSale ? (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-gray-500 line-through text-lg">{formatPrice(tierPrice)}</span>
                <span className="text-red-400 text-2xl font-industrial">{formatPrice(currentPrice)}</span>
                <span className="text-red-400 text-xs font-bold bg-red-500/20 px-2 py-0.5 rounded">−{appliedSale.discount_percent}%</span>
                <span className="text-gray-400 text-sm">per unit</span>
              </div>
              <div className="text-red-400/90 text-xs mt-1 flex items-center gap-1.5">
                <span className="font-bold uppercase tracking-wider">{appliedSale.name}</span>
                <span className="text-gray-500">·</span>
                <span>Ends in </span>
                <SaleCountdown
                  endsAt={appliedSale.ends_at}
                  className="font-mono"
                  onExpire={() => forceTick(t => t + 1)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-3xl font-industrial font-bold tabular-nums">{formatPrice(currentPrice)}</span>
                <span className="text-gray-400 text-sm">per unit</span>
              </div>
              {currentPrice < basePrice && (
                <div className="text-green-400 text-sm mt-1">Volume discount applied!</div>
              )}
            </>
          )}
        </div>

        {/* Inventory Progress Bar */}
        <InventoryProgressBar stock={stock} totalStock={totalStock} loading={stockLoading} />

        {/* Quantity Selector */}
        <div className="mb-4 mt-4">
          <label htmlFor={`qty-${product.id}`} className="block text-gray-400 text-xs uppercase tracking-[0.1em] mb-2">
            Quantity (min. {effectiveMin}{productStep > 1 ? `, in ${productStep}s` : ''})
          </label>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl ring-1 ring-inset ring-gray-600 overflow-hidden">
              <button
                type="button"
                onClick={() => handleQuantityChange(-productStep)}
                disabled={outOfStock}
                aria-label={`Decrease quantity by ${productStep}`}
                className="min-w-[44px] min-h-[44px] px-3 text-white hover:bg-gray-700 transition-colors text-sm tabular-nums disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent"
              >
                -{productStep}
              </button>
              <input
                id={`qty-${product.id}`}
                type="number"
                value={quantityDraft}
                onChange={(e) => setQuantityDraft(e.target.value)}
                disabled={outOfStock}
                onBlur={() => {
                  const raw = parseInt(quantityDraft, 10)
                  const rounded = isLowStock
                    ? (isNaN(raw) ? effectiveMin : raw)
                    : Math.round((isNaN(raw) ? effectiveMin : raw) / productStep) * productStep
                  const clamped = Math.min(maxQty, Math.max(effectiveMin, rounded))
                  setQuantity(clamped)
                  setQuantityDraft(String(clamped))
                }}
                className="w-20 text-center bg-transparent text-white border-0 border-x border-gray-600 rounded-none py-2 text-sm tabular-nums focus:ring-inset disabled:cursor-not-allowed disabled:text-gray-400"
                min={productMin}
                step={productStep}
              />
              <button
                type="button"
                onClick={() => handleQuantityChange(productStep)}
                disabled={outOfStock}
                aria-label={`Increase quantity by ${productStep}`}
                className="min-w-[44px] min-h-[44px] px-3 text-white hover:bg-gray-700 transition-colors text-sm tabular-nums disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent"
              >
                +{productStep}
              </button>
            </div>
            <span className="text-gray-400 text-sm">
              Total: <span className="text-yellow-500 font-bold tabular-nums">{formatPrice(totalPrice)}</span>
            </span>
          </div>
        </div>

        {/* Stock warnings */}
        {isLowStock && (
          <p className="text-yellow-500 text-xs mb-2">Only {stock} available — min order reduced from {productMin}</p>
        )}
        {!isLowStock && !outOfStock && stock !== null && quantity >= stock && (
          <p className="text-yellow-500 text-xs mb-2">Max available: {stock} units</p>
        )}

        {/* Add to Cart */}
        <button
          onClick={handleAddToCart}
          disabled={outOfStock || (!stockLoading && stock !== null && quantity > stock)}
          className="btn-primary w-full mt-auto"
        >
          {outOfStock ? 'Out of Stock' : `Add ${quantity} to Cart`}
        </button>
      </div>
    </article>
  )
}

// Shared storefront grid: hero header, pricing banner, min-order notice,
// product cards, "more products coming" footer. Rendered both on the
// /products page and at the top of the homepage so the catalogue is the
// first thing customers see when they land on driveshaftcable.com.
function StorefrontProducts() {
  const { products, loading } = useStorefrontProducts()

  return (
    <>
      {/* Hero Section */}
      <section className="pt-12 pb-10 md:pt-16 md:pb-12 section-glow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div>
            <p className="eyebrow mb-4">Heavy-Duty Towing Safety</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial font-bold text-white mb-4 leading-[0.98]">
              SHOP <span className="text-gradient">DRIVESHAFT CABLES</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl">
              Professional-grade equipment for heavy-duty towing and recovery operations.
            </p>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="pb-20 md:pb-24 bg-ktodd-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Pricing Info Banner */}
          <div className="surface-gold p-5 sm:p-6 mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-white font-industrial text-lg tracking-[0.06em]">Volume Pricing (per product)</h2>
                <div className="text-sm text-gray-300 space-y-1">
                  <div><span className="text-yellow-500">FREE SHIPPING</span> on orders over $400 · $15 flat rate under $400</div>
                  <div><span className="text-green-400">LOYALTY DISCOUNT</span> — returning customers get an extra 10% off!</div>
                </div>
              </div>
              <div className={`grid gap-4 ${products.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {products.map(p => {
                  const pricing = PRODUCT_PRICING[p.id]
                  if (!pricing) return null
                  return (
                    <div key={p.id} className="bg-black/30 rounded-xl ring-1 ring-inset ring-yellow-500/25 p-4">
                      <div className="text-xs uppercase tracking-wider text-yellow-500 font-bold mb-2">{p.name}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm tabular-nums">
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
                  )
                })}
              </div>
            </div>
          </div>

          {/* Minimum-order notice removed — each product card now shows its
              own min/step in the quantity selector, since the brake caging
              bolt sells in 1s while the cables ship in 10-packs. */}

          {/* Products */}
          {loading && products.length === 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-busy="true" aria-label="Loading products">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl ring-1 ring-gray-700 bg-gray-900 overflow-hidden">
                  <div className="aspect-[4/3] bg-gray-800 animate-pulse" />
                  <div className="p-6 space-y-3">
                    <div className="h-6 w-2/3 rounded bg-gray-800 animate-pulse" />
                    <div className="h-4 w-full rounded bg-gray-800 animate-pulse" />
                    <div className="h-12 w-full rounded-xl bg-gray-800 animate-pulse" />
                  </div>
                </div>
              ))}
              <span className="sr-only">Loading products…</span>
            </div>
          ) : products.length === 0 ? (
            <div role="status" className="text-gray-400 py-12 text-center border border-dashed border-gray-600 rounded-2xl">
              No products available right now. Check back soon.
            </div>
          ) : (
            <div className={`grid md:grid-cols-2 gap-6 ${products.length >= 3 ? 'lg:grid-cols-3' : 'max-w-5xl'}`}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* More products coming */}
          <div className="mt-16 text-center">
            <div className="inline-block surface px-8 py-6">
              <p className="text-gray-400 mb-2">More products coming soon</p>
              <p className="text-white font-industrial">DRIVELINE ACCESSORIES & SAFETY EQUIPMENT</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default StorefrontProducts
