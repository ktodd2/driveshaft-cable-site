import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCartStore, formatPrice } from '../stores/cartStore'

function CartPage() {
  const navigate = useNavigate()
  const { items, updateQuantity, removeItem, clearCart } = useCartStore()
  const totalItems = useCartStore((state) => state.totalItems)
  const subtotal = useCartStore((state) => state.subtotal)
  const isBulkOrder = totalItems >= 10

  const handleQuantityChange = (productId, delta) => {
    const item = items.find(i => i.productId === productId)
    if (item) {
      updateQuantity(productId, item.quantity + delta)
    }
  }

  const handleCheckout = () => {
    if (isBulkOrder) {
      navigate('/quote')
    } else {
      navigate('/checkout')
    }
  }

  if (items.length === 0) {
    return (
      <div className="pt-20 min-h-screen bg-ktodd-dark">
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
    <div className="pt-20">
      {/* Header */}
      <section className="py-12 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-industrial text-white">
            YOUR <span className="text-yellow-500">CART</span>
          </h1>
          <p className="text-gray-400 mt-2">{totalItems} item{totalItems !== 1 ? 's' : ''} in cart</p>
        </div>
      </section>

      {/* Cart Content */}
      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              {/* Bulk Order Notice */}
              {isBulkOrder && (
                <div className="bg-yellow-500/10 border border-yellow-500 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-white font-bold">Volume Order Detected!</p>
                      <p className="text-gray-300 text-sm">Your order of {totalItems} units qualifies for volume pricing. Proceed to request a custom quote.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {items.map((item) => (
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
                        <p className="text-gray-400 text-sm mb-4">SKU: {item.sku}</p>

                        <div className="flex flex-wrap items-center gap-4">
                          {/* Quantity */}
                          <div className="flex items-center border border-gray-700">
                            <button
                              onClick={() => handleQuantityChange(item.productId, -1)}
                              className="px-3 py-1 text-white hover:bg-gray-700 transition-colors"
                            >
                              -
                            </button>
                            <span className="px-4 py-1 text-white border-x border-gray-700">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.productId, 1)}
                              className="px-3 py-1 text-white hover:bg-gray-700 transition-colors"
                            >
                              +
                            </button>
                          </div>

                          {/* Price */}
                          <div className="text-yellow-500 font-bold">
                            {formatPrice(item.price * item.quantity)}
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
                ))}
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
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal ({totalItems} items)</span>
                    <span className="text-white">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Shipping</span>
                    <span className="text-white">Calculated at checkout</span>
                  </div>
                  <div className="border-t border-gray-700 pt-4 flex justify-between">
                    <span className="text-white font-bold">Estimated Total</span>
                    <span className="text-yellow-500 font-bold text-xl">{formatPrice(subtotal)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="btn-primary w-full mb-4"
                >
                  {isBulkOrder ? 'Request Volume Quote' : 'Proceed to Checkout'}
                </button>

                {!isBulkOrder && (
                  <p className="text-gray-400 text-xs text-center">
                    Ordering 10+ units? <Link to="/quote" className="text-yellow-500 hover:text-yellow-400">Get volume pricing</Link>
                  </p>
                )}

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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    All major credit cards accepted
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
