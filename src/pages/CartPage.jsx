import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useCartStore,
  selectTotalItems,
  selectSubtotal,
  selectPricePerUnit,
  selectMeetsMinimum,
  selectHasBulkDiscount,
  selectShipping,
  selectOrderTotal,
  selectVolumeSavings,
  formatPrice,
  PRICE_PER_UNIT,
  PRICING_TIERS,
  PRODUCT_PRICING,
  getPriceForQuantity,
  getTierPriceForQuantity,
  getActiveSaleForProduct,
  MIN_ORDER_QUANTITY,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  selectRequiredMinimum,
  getStepForProduct,
} from '../stores/cartStore'
import SaleCountdown from '../components/common/SaleCountdown'
import SEOHead from '../components/common/SEOHead'

function CartPage() {
  const navigate = useNavigate()
  const { items, updateQuantity, removeItem, clearCart } = useCartStore()
  const totalItems = useCartStore(selectTotalItems)
  const subtotal = useCartStore(selectSubtotal)
  const pricePerUnit = useCartStore(selectPricePerUnit)
  const meetsMinimum = useCartStore(selectMeetsMinimum)
  const requiredMinimum = useCartStore(selectRequiredMinimum)
  const hasBulkDiscount = useCartStore(selectHasBulkDiscount)
  const shipping = useCartStore(selectShipping)
  const orderTotal = useCartStore(selectOrderTotal)
  const volumeSavings = useCartStore(selectVolumeSavings)

  const handleQuantityChange = (productId, delta) => {
    const item = items.find(i => i.productId === productId)
    if (item) {
      const newQty = item.quantity + delta
      if (newQty >= 1) {
        updateQuantity(productId, newQty)
      }
    }
  }

  const handleCheckout = () => {
    if (meetsMinimum) {
      navigate('/checkout')
    }
  }

  // Find the closest next-tier unlock across all line items. With per-product
  // tier qualification, the cart-wide "Unlock better pricing" hint becomes
  // per-line — pick whichever line is closest to its own next tier.
  const getNextTier = () => {
    let best = null
    for (const item of items) {
      const pricing = PRODUCT_PRICING[item.productId]
      if (!pricing) continue
      const sortedTiers = [...pricing.tiers].sort((a, b) => a.min - b.min)
      for (const tier of sortedTiers) {
        if (item.quantity < tier.min) {
          const unitsNeeded = tier.min - item.quantity
          if (!best || unitsNeeded < best.unitsNeeded) {
            best = { unitsNeeded, price: tier.price, productName: item.name }
          }
          break
        }
      }
    }
    return best
  }
  const nextTier = getNextTier()

  if (items.length === 0) {
    return (
      <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-industrial text-white mb-4">YOUR CART IS EMPTY</h1>
          <p className="text-gray-400 mb-8">Looks like you haven't added any items yet.</p>
          <Link to="/products" className="btn-primary">
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title="Your Cart"
        noindex={true}
        canonical="/cart"
      />
      {/* Header */}
      <section className="py-12 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-industrial text-white">
            YOUR <span className="text-yellow-500">CART</span>
          </h1>
          <p className="text-gray-400 mt-2">{totalItems} unit{totalItems !== 1 ? 's' : ''} in cart</p>
        </div>
      </section>

      {/* Cart Content */}
      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              {/* Minimum Order Warning */}
              {!meetsMinimum && (
                <div className="bg-red-500/10 border border-red-500 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-white font-bold">Minimum Order Not Met</p>
                      <p className="text-gray-300 text-sm">
                        Add {requiredMinimum - totalItems} more unit{requiredMinimum - totalItems !== 1 ? 's' : ''} to meet the minimum order of {requiredMinimum} units.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Volume Discount Notice */}
              {hasBulkDiscount && (
                <div className="bg-green-500/10 border border-green-500 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="text-white font-bold">Volume Discount Applied!</p>
                      <p className="text-gray-300 text-sm">
                        You're saving {formatPrice(volumeSavings)} with bulk pricing.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Tier Teaser */}
              {nextTier && meetsMinimum && (
                <div className="bg-yellow-500/10 border border-yellow-500 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-white font-bold">Unlock Better Pricing!</p>
                      <p className="text-gray-300 text-sm">
                        Add {nextTier.unitsNeeded} more {nextTier.productName} unit{nextTier.unitsNeeded !== 1 ? 's' : ''} to get {formatPrice(nextTier.price)}/unit
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {items.map((item) => {
                  const linePrice = getPriceForQuantity(item.productId, item.quantity)
                  const tierPrice = getTierPriceForQuantity(item.productId, item.quantity)
                  const basePrice = PRODUCT_PRICING[item.productId]?.basePrice ?? PRICE_PER_UNIT
                  const appliedSale = getActiveSaleForProduct(item.productId)
                  const lineHasDiscount = linePrice < basePrice
                  // When a sale is active, the strike-through shows the tier price the
                  // customer would have paid pre-sale (more honest than basePrice when
                  // they qualify for a tier). Otherwise we fall back to the original
                  // base-vs-tier behavior.
                  const struckPrice = appliedSale ? tierPrice : basePrice
                  return (
                  <div key={item.productId} className="bg-gray-800/50 border border-gray-700 p-4 sm:p-6">
                    <div className="flex gap-4 sm:gap-6">
                      {/* Product Image */}
                      <Link to={`/products/${item.slug}`} className="flex-shrink-0">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                          <svg viewBox="0 0 100 80" className="w-20 h-16">
                            <path d="M 15 40 Q 50 20 85 40" stroke="#9CA3AF" strokeWidth="4" fill="none" />
                            <rect x="5" y="32" width="18" height="16" rx="2" fill="#D4A017" />
                            <rect x="77" y="32" width="18" height="16" rx="2" fill="#D4A017" />
                          </svg>
                        </div>
                      </Link>

                      {/* Product Info */}
                      <div className="flex-grow">
                        <Link to={`/products/${item.slug}`} className="text-lg font-bold text-white hover:text-yellow-500 transition-colors">
                          {item.name}
                        </Link>
                        <p className="text-gray-400 text-sm mb-2">SKU: {item.sku}</p>
                        <p className={`text-sm ${appliedSale ? 'text-red-400' : lineHasDiscount ? 'text-green-400' : 'text-yellow-500'}`}>
                          {formatPrice(linePrice)}/unit
                          {(appliedSale || lineHasDiscount) && (
                            <span className="text-gray-500 line-through ml-2">{formatPrice(struckPrice)}</span>
                          )}
                          {appliedSale && (
                            <span className="text-red-400 text-xs font-bold bg-red-500/20 px-2 py-0.5 rounded ml-2">−{appliedSale.discount_percent}%</span>
                          )}
                        </p>
                        {appliedSale && (
                          <p className="text-red-400/90 text-xs mb-3 flex items-center gap-1.5">
                            <span className="font-bold uppercase tracking-wider">{appliedSale.name}</span>
                            <span className="text-gray-500">·</span>
                            <span>Ends in </span>
                            <SaleCountdown endsAt={appliedSale.ends_at} className="font-mono" />
                          </p>
                        )}
                        {!appliedSale && <div className="mb-4" />}

                        <div className="flex flex-wrap items-center gap-4">
                          {/* Quantity — increment matches each product's
                              order-step (10 for cables, 1 for the bolt). */}
                          {(() => {
                            const itemStep = getStepForProduct(item.productId)
                            return (
                              <div className="flex items-center border border-gray-700">
                                <button
                                  onClick={() => handleQuantityChange(item.productId, -itemStep)}
                                  className="px-3 py-1 text-white hover:bg-gray-700 transition-colors text-sm font-bold"
                                >
                                  -{itemStep}
                                </button>
                                <span className="px-4 py-1 text-white border-x border-gray-700 min-w-[60px] text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleQuantityChange(item.productId, itemStep)}
                                  className="px-3 py-1 text-white hover:bg-gray-700 transition-colors text-sm font-bold"
                                >
                                  +{itemStep}
                                </button>
                              </div>
                            )
                          })()}

                          {/* Price */}
                          <div className="text-yellow-500 font-bold">
                            {formatPrice(linePrice * item.quantity)}
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-gray-400 hover:text-red-500 transition-colors ml-auto"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>

              {/* Clear Cart */}
              <div className="mt-4 flex justify-between items-center">
                <Link to="/products" className="text-yellow-500 hover:text-yellow-400 transition-colors">
                  ← Continue Shopping
                </Link>
                <button
                  onClick={clearCart}
                  className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                >
                  Clear Cart
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="bg-gray-800/50 border border-gray-700 p-6 sticky top-24">
                <h2 className="text-xl font-industrial text-yellow-500 mb-6">ORDER SUMMARY</h2>

                <div className="space-y-4 mb-6">
                  <div className="text-gray-400 space-y-1">
                    {items.map(item => {
                      const linePrice = getPriceForQuantity(item.productId, item.quantity)
                      return (
                        <div key={item.productId} className="flex justify-between text-sm">
                          <span>{item.quantity} × {item.name}</span>
                          <span className="text-white">{formatPrice(linePrice * item.quantity)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between pt-2 border-t border-gray-700/50">
                      <span>Subtotal</span>
                      <span className="text-white">{formatPrice(subtotal)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Shipping</span>
                    {shipping === 0
                      ? <span className="text-green-400 font-bold">FREE</span>
                      : <span className="text-white">{formatPrice(SHIPPING_FEE)}</span>
                    }
                  </div>
                  {shipping > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/50 px-3 py-2 text-xs text-yellow-400">
                      Add {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more to get FREE shipping
                    </div>
                  )}
                  {hasBulkDiscount && (
                    <div className="flex justify-between text-green-400 text-sm">
                      <span>Volume discount</span>
                      <span>-{formatPrice(volumeSavings)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-4 flex justify-between">
                    <span className="text-white font-bold">Total</span>
                    <span className="text-yellow-500 font-bold text-xl">{formatPrice(orderTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={!meetsMinimum}
                  className="btn-primary w-full mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {meetsMinimum ? 'Proceed to Checkout' : `Add ${requiredMinimum - totalItems} More Units`}
                </button>

                {/* Per-product pricing tiers */}
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <p className="text-gray-400 text-sm mb-3">Volume Pricing (per product):</p>
                  {Object.entries(PRODUCT_PRICING).map(([pid, pricing]) => {
                    const cartItem = items.find(i => i.productId === pid)
                    const activePrice = cartItem
                      ? getPriceForQuantity(pid, cartItem.quantity)
                      : null
                    return (
                      <div key={pid} className="mb-3 last:mb-0">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">{pricing.name}</div>
                        <div className="space-y-1 text-sm">
                          <div className={`flex justify-between ${activePrice === pricing.basePrice ? 'text-yellow-500' : 'text-gray-500'}`}>
                            <span>10-49 units</span>
                            <span>{formatPrice(pricing.basePrice)}/ea</span>
                          </div>
                          {pricing.tiers.slice().reverse().map((tier, i) => (
                            <div key={i} className={`flex justify-between ${activePrice === tier.price ? 'text-green-400' : 'text-gray-500'}`}>
                              <span>{tier.label} units</span>
                              <span>{formatPrice(tier.price)}/ea</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Loyalty Discount Note */}
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="bg-green-500/10 border border-green-500/30 px-3 py-2 text-xs text-green-400">
                    Returning customer? Get an extra <span className="font-bold">10% off</span> at checkout — automatically applied!
                  </div>
                </div>

                {/* Security badges */}
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Secure checkout with Stripe
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Free shipping on orders over $400
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default CartPage
