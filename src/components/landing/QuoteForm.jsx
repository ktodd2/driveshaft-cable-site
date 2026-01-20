import React, { useState } from 'react'
import { submitQuoteRequest } from '../../lib/supabase'

function QuoteForm() {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    quantity: '',
    message: ''
  })
  const [status, setStatus] = useState('idle') // idle, submitting, success, error
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    try {
      await submitQuoteRequest({
        ...formData,
        quantity: formData.quantity ? parseInt(formData.quantity) : null
      })
      setStatus('success')
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
      console.error('Form submission error:', error)
    }
  }

  return (
    <section id="quote" className="py-20 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left side - CTA content */}
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
              READY TO <span className="text-yellow-500">ORDER?</span>
            </h2>
            <div className="w-24 h-1 bg-yellow-500 mb-6"></div>

            <p className="text-xl text-gray-300 mb-8">
              Get a quote for the K.Todd Driveshaft Cable. Volume discounts available for fleet and wholesale orders.
            </p>

            <div className="space-y-6 mb-8">
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
                  <div className="text-white font-bold">Volume Pricing</div>
                  <div className="text-gray-400 text-sm">Discounts for orders of 10+ units</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-500/20 border border-yellow-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-bold">Ships from Houston, TX</div>
                  <div className="text-gray-400 text-sm">Fast shipping across the USA</div>
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div className="bg-gray-800/50 border border-gray-700 p-6">
              <p className="text-gray-400 mb-4">Prefer to talk? Contact us directly:</p>
              <div className="space-y-2">
                <a href="mailto:houstontruckwreck@gmail.com" className="flex items-center gap-3 text-yellow-500 hover:text-yellow-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  houstontruckwreck@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Right side - Form */}
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
                <button
                  onClick={() => setStatus('idle')}
                  className="text-yellow-500 hover:text-yellow-400 underline"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-industrial text-yellow-500 mb-6">REQUEST A QUOTE</h3>

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
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="quantity" className="block text-gray-400 text-sm mb-1">Quantity Needed</label>
                    <select
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      className="bg-gray-800 border border-gray-600 text-white px-4 py-3 w-full focus:border-yellow-500 focus:outline-none"
                    >
                      <option value="">Select quantity</option>
                      <option value="1">1-5 units</option>
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
                    {status === 'submitting' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Quote Request'
                    )}
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
  )
}

export default QuoteForm
