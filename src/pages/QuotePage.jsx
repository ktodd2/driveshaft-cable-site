import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '../stores/cartStore'
import { supabase } from '../lib/supabase'

function QuotePage() {
  const { items, totalItems, clearCart } = useCartStore()
  const subtotal = useCartStore((state) => state.subtotal)

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    quantity: totalItems > 0 ? totalItems.toString() : '',
    message: ''
  })
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    try {
      const { error } = await supabase
        .from('quote_requests')
        .insert([{
          name: formData.name,
          company: formData.company,
          email: formData.email,
          phone: formData.phone,
          quantity: formData.quantity ? parseInt(formData.quantity) : null,
          message: formData.message,
          created_at: new Date().toISOString()
        }])

      if (error) throw error

      setStatus('success')
      clearCart()
      setFormData({
        name: '',
        company: '',
        email: '',
        phone: '',
        quantity: '',
        message: ''
      })
    } catch (error) {
      setStatus('error')
      setErrorMessage('There was an error submitting your request. Please try again or contact us directly.')
      console.error('Quote submission error:', error)
    }
  }

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
              REQUEST A <span className="text-yellow-500">QUOTE</span>
            </h1>
            <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Get volume pricing for orders of 10+ units. We'll respond within 24 hours.
            </p>
          </div>
        </div>
      </section>

      {/* Quote Content */}
      <section className="py-16 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Left Side - Benefits */}
            <div>
              <h2 className="text-2xl font-industrial text-yellow-500 mb-8">VOLUME PRICING BENEFITS</h2>

              <div className="space-y-6 mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-500/20 border border-yellow-500 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-bold">Discounted Pricing</div>
                    <div className="text-gray-400 text-sm">Save more with larger orders</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-500/20 border border-yellow-500 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-bold">Fast Response</div>
                    <div className="text-gray-400 text-sm">Quotes returned within 24 hours</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-500/20 border border-yellow-500 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-bold">Priority Shipping</div>
                    <div className="text-gray-400 text-sm">Ships from Houston, TX</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-500/20 border border-yellow-500 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-bold">Fleet Support</div>
                    <div className="text-gray-400 text-sm">Custom solutions for large fleets</div>
                  </div>
                </div>
              </div>

              {/* Pricing Tiers */}
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <h3 className="text-lg font-industrial text-white mb-4">VOLUME PRICING TIERS</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">1-9 units</span>
                    <span className="text-white">Standard pricing</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">10-24 units</span>
                    <span className="text-yellow-500 font-bold">Contact for quote</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">25-49 units</span>
                    <span className="text-yellow-500 font-bold">Contact for quote</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">50-99 units</span>
                    <span className="text-yellow-500 font-bold">Contact for quote</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">100+ units</span>
                    <span className="text-yellow-500 font-bold">Contact for quote</span>
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="mt-8 bg-gray-800/50 border border-gray-700 p-6">
                <p className="text-gray-400 mb-4">Prefer to talk? Contact us directly:</p>
                <a href="mailto:houstontruckwreck@gmail.com" className="flex items-center gap-3 text-yellow-500 hover:text-yellow-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  houstontruckwreck@gmail.com
                </a>
              </div>
            </div>

            {/* Right Side - Form */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 md:p-8">
              {status === 'success' ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-industrial text-white mb-4">QUOTE REQUEST RECEIVED!</h3>
                  <p className="text-gray-400 mb-6">We'll get back to you within 24 hours with pricing and availability.</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => setStatus('idle')}
                      className="text-yellow-500 hover:text-yellow-400 underline"
                    >
                      Submit another request
                    </button>
                    <Link to="/products" className="text-gray-400 hover:text-white">
                      Continue browsing
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-industrial text-yellow-500 mb-6">REQUEST A QUOTE</h3>

                  {items.length > 0 && (
                    <div className="bg-gray-700/50 border border-gray-600 p-4 mb-6">
                      <p className="text-gray-400 text-sm mb-2">Cart items included in quote:</p>
                      <div className="text-white font-bold">{totalItems} x K.Todd Driveshaft Cable</div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-gray-400 text-sm mb-1">Name *</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Your name"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="company" className="block text-gray-400 text-sm mb-1">Company</label>
                        <input
                          type="text"
                          id="company"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          placeholder="Company name"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="email" className="block text-gray-400 text-sm mb-1">Email *</label>
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
                        <label htmlFor="phone" className="block text-gray-400 text-sm mb-1">Phone</label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="(555) 555-5555"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="quantity" className="block text-gray-400 text-sm mb-1">Quantity Needed *</label>
                      <select
                        id="quantity"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                      >
                        <option value="">Select quantity</option>
                        <option value="10">10-24 units</option>
                        <option value="25">25-49 units</option>
                        <option value="50">50-99 units</option>
                        <option value="100">100+ units</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-gray-400 text-sm mb-1">Message</label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows="4"
                        placeholder="Tell us about your needs, timeline, or any questions..."
                        className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none resize-none"
                      ></textarea>
                    </div>

                    {status === 'error' && (
                      <div className="bg-red-500/20 border border-red-500 p-4 text-red-400 text-sm">
                        {errorMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === 'submitting' ? 'Submitting...' : 'Submit Quote Request'}
                    </button>

                    <p className="text-gray-500 text-xs text-center">
                      By submitting, you agree to be contacted regarding your quote request.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default QuotePage
