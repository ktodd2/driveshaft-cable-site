import React from 'react'
import { Link, useLocation } from 'react-router-dom'

function OrderSuccessPage() {
  const location = useLocation()
  const { orderNumber, email } = location.state || {
    orderNumber: 'ORD-XXXXXX',
    email: 'your@email.com'
  }

  return (
    <div className="pt-20 min-h-screen bg-ktodd-dark">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-4">
            ORDER <span className="text-yellow-500">CONFIRMED!</span>
          </h1>
          <p className="text-gray-400">
            Thank you for your order. We've sent a confirmation to <span className="text-white">{email}</span>
          </p>
        </div>

        {/* Order Info */}
        <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
            <span className="text-gray-400">Order Number</span>
            <span className="text-yellow-500 font-industrial text-lg">{orderNumber}</span>
          </div>
          <p className="text-gray-400 text-sm">
            We'll process your order and send you shipping information once it's on the way.
          </p>
        </div>

        {/* What's Next */}
        <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-industrial text-yellow-500 mb-4">WHAT'S NEXT?</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-black font-bold text-sm">1</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Order Confirmation</h3>
                <p className="text-gray-400 text-sm">You'll receive an email confirmation shortly.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 font-bold text-sm">2</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Processing</h3>
                <p className="text-gray-400 text-sm">We'll prepare your order for shipment.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 font-bold text-sm">3</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Shipping</h3>
                <p className="text-gray-400 text-sm">You'll receive tracking info when your order ships.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 font-bold text-sm">4</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Delivery</h3>
                <p className="text-gray-400 text-sm">Your K.Todd Driveshaft Cable arrives!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/order-tracking" className="flex-1 btn-primary text-center">
            Track Order
          </Link>
          <Link to="/products" className="flex-1 border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial text-center">
            Continue Shopping
          </Link>
        </div>

        {/* Support */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 mb-2">Questions about your order?</p>
          <a href="mailto:houstontruckwreck@gmail.com" className="text-yellow-500 hover:text-yellow-400 transition-colors">
            houstontruckwreck@gmail.com
          </a>
        </div>
      </div>
    </div>
  )
}

export default OrderSuccessPage
