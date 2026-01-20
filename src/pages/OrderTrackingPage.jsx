import React, { useState } from 'react'
import { Link } from 'react-router-dom'

function OrderTrackingPage() {
  const [formData, setFormData] = useState({
    orderNumber: '',
    email: ''
  })
  const [status, setStatus] = useState('idle') // idle, loading, found, not_found
  const [order, setOrder] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')

    // TODO: Implement actual order lookup from Supabase
    // For now, simulate a response
    setTimeout(() => {
      // Simulate not found for demo
      setStatus('not_found')
    }, 1500)
  }

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
              TRACK YOUR <span className="text-yellow-500">ORDER</span>
            </h1>
            <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Enter your order number and email to check your order status.
            </p>
          </div>
        </div>
      </section>

      {/* Tracking Content */}
      <section className="py-16 bg-ktodd-charcoal">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800/50 border border-gray-700 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="orderNumber" className="block text-gray-400 text-sm mb-1">Order Number *</label>
                <input
                  type="text"
                  id="orderNumber"
                  name="orderNumber"
                  value={formData.orderNumber}
                  onChange={handleChange}
                  required
                  placeholder="ORD-XXXXXX"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-gray-400 text-sm mb-1">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your@email.com"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Looking up order...
                  </span>
                ) : (
                  'Track Order'
                )}
              </button>
            </form>

            {/* Not Found Message */}
            {status === 'not_found' && (
              <div className="mt-6 bg-red-500/10 border border-red-500 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-white font-bold">Order Not Found</p>
                    <p className="text-gray-300 text-sm">We couldn't find an order matching that information. Please check your order number and email address.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Order Found - Status Display */}
            {status === 'found' && order && (
              <div className="mt-6 space-y-6">
                <div className="border-t border-gray-700 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-400">Order Number</span>
                    <span className="text-yellow-500 font-industrial">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-400">Status</span>
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 text-sm">{order.status}</span>
                  </div>
                  {order.tracking && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Tracking</span>
                      <a href={`https://tracking.example.com/${order.tracking}`} className="text-yellow-500 hover:text-yellow-400" target="_blank" rel="noopener noreferrer">
                        {order.tracking}
                      </a>
                    </div>
                  )}
                </div>

                {/* Status Timeline */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Order Placed</h3>
                      <p className="text-gray-400 text-sm">Jan 15, 2024 at 2:30 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Processing</h3>
                      <p className="text-gray-400 text-sm">Jan 15, 2024 at 3:45 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-black animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Shipped</h3>
                      <p className="text-gray-400 text-sm">In transit</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 opacity-50">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-sm">4</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Delivered</h3>
                      <p className="text-gray-400 text-sm">Pending</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Help */}
          <div className="mt-8 text-center">
            <p className="text-gray-400 mb-2">Can't find your order?</p>
            <Link to="/contact" className="text-yellow-500 hover:text-yellow-400 transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default OrderTrackingPage
