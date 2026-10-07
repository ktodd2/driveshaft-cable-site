import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SEOHead from '../components/common/SEOHead'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const STATUS_LABELS = {
  pending: 'Processing',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function OrderTimeline({ order }) {
  const shipped = order.status === 'shipped' || order.status === 'delivered'
  const delivered = order.status === 'delivered'
  const steps = [
    { label: 'Order Placed', detail: formatDate(order.placedAt), done: true },
    { label: 'Shipped', detail: shipped ? (order.carrier ? `Via ${order.carrier}` : 'In transit') : 'Preparing your order', done: shipped },
    { label: 'Delivered', detail: delivered ? (order.deliveredAt ? formatDate(order.deliveredAt) : 'Delivered') : 'Pending', done: delivered },
  ]

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={step.label} className={`flex items-start gap-4 ${step.done ? '' : 'opacity-50'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-green-500' : 'bg-gray-700'}`}>
            {step.done ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-gray-400 text-sm">{i + 1}</span>
            )}
          </div>
          <div>
            <h3 className="text-white font-bold">{step.label}</h3>
            <p className="text-gray-400 text-sm">{step.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function OrderTrackingPage() {
  const [formData, setFormData] = useState({
    reference: '',
    email: ''
  })
  const [status, setStatus] = useState('idle') // idle, loading, found, not_found, error
  const [orders, setOrders] = useState([])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')

    const { data, error } = await supabase.functions.invoke('track-order', {
      body: { email: formData.email, reference: formData.reference },
    })

    if (error) {
      console.error('Order lookup failed:', error)
      setStatus('error')
      return
    }

    const found = data?.orders || []
    setOrders(found)
    setStatus(found.length > 0 ? 'found' : 'not_found')
  }

  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title="Order Tracking"
        description="Track your Driveshaft Cable order. Enter your email and order number or shipping ZIP code to check your order status."
        noindex
      />
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
              TRACK YOUR <span className="text-yellow-500">ORDER</span>
            </h1>
            <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Enter your email and your order number or shipping ZIP code.
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

              <div>
                <label htmlFor="reference" className="block text-gray-400 text-sm mb-1">Order Number or Shipping ZIP *</label>
                <input
                  type="text"
                  id="reference"
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 3F2A9C1B or 77001"
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
                    <p className="text-gray-300 text-sm">We couldn't find an order matching that information. Please check your email address and order number or ZIP code. Orders appear here once payment is confirmed.</p>
                  </div>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="mt-6 bg-red-500/10 border border-red-500 p-4">
                <p className="text-white font-bold">Something Went Wrong</p>
                <p className="text-gray-300 text-sm">We couldn't look up your order right now. Please try again in a moment.</p>
              </div>
            )}

            {/* Order Found - Status Display */}
            {status === 'found' && orders.map((order) => (
              <div key={order.orderNumber} className="mt-6 space-y-6 border-t border-gray-700 pt-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-400">Order Number</span>
                    <span className="text-yellow-500 font-industrial">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-400">Status</span>
                    <span className={`px-3 py-1 text-sm ${order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  {order.items.length > 0 && (
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <span className="text-gray-400">Items</span>
                      <span className="text-white text-right text-sm">
                        {order.items.map((item, i) => (
                          <span key={i} className="block">{item.quantity} × {item.name}</span>
                        ))}
                      </span>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Tracking{order.carrier ? ` (${order.carrier})` : ''}</span>
                      {order.trackingUrl ? (
                        <a href={order.trackingUrl} className="text-yellow-500 hover:text-yellow-400 font-mono" target="_blank" rel="noopener noreferrer">
                          {order.trackingNumber}
                        </a>
                      ) : (
                        <span className="text-white font-mono">{order.trackingNumber}</span>
                      )}
                    </div>
                  )}
                </div>

                {order.status !== 'cancelled' && <OrderTimeline order={order} />}
              </div>
            ))}
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
