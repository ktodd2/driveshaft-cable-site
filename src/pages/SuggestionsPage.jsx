import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SEOHead from '../components/common/SEOHead'

function SuggestionsPage() {
  const [formData, setFormData] = useState({ email: '', name: '', message: '' })
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

    const normalizedEmail = formData.email.trim().toLowerCase()
    const trimmedMessage = formData.message.trim()
    const trimmedName = formData.name.trim()

    const { error: suggestionError } = await supabase
      .from('suggestions')
      .insert({
        email: normalizedEmail,
        name: trimmedName || null,
        message: trimmedMessage,
      })

    if (suggestionError) {
      setStatus('error')
      setErrorMessage('Something went wrong submitting your suggestion. Please try again.')
      console.error('Suggestion insert failed:', suggestionError)
      return
    }

    // Side-effect: subscribe email to newsletter. Failure is non-fatal —
    // the suggestion is already saved. 23505 = duplicate (already subscribed).
    const { error: newsletterError } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: normalizedEmail, source: 'suggestion_box' })
    if (newsletterError && newsletterError.code !== '23505') {
      console.warn('Newsletter signup from suggestion box failed:', newsletterError)
    }

    setFormData({ email: '', name: '', message: '' })
    setStatus('success')
  }

  return (
    <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
      <SEOHead
        title="Suggestions"
        description="Have an idea, product request, or feedback for Driveshaft Cable? Drop us a suggestion."
        canonical="/suggestions"
      />

      {/* Header */}
      <section className="py-12 bg-ktodd-dark border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-2">
            HAVE A <span className="text-yellow-500">SUGGESTION?</span>
          </h1>
          <div className="w-24 h-1 bg-yellow-500 mb-4"></div>
          <p className="text-gray-400 text-lg">
            Got a product idea, a feature request, or just feedback for us? We read every submission.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800/50 border border-gray-700 p-6 md:p-8">
            {status === 'success' ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-industrial text-white mb-4">THANKS!</h3>
                <p className="text-gray-400 mb-6">
                  Your suggestion is in. We'll take a look soon, and you're now on the list for product updates.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setStatus('idle')}
                    className="text-yellow-500 hover:text-yellow-400 underline"
                  >
                    Send another suggestion
                  </button>
                  <span className="text-gray-600 hidden sm:inline">·</span>
                  <Link to="/" className="text-gray-400 hover:text-white">
                    Back to home
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-industrial text-yellow-500 mb-6">SEND A SUGGESTION</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                    <label htmlFor="name" className="block text-gray-400 text-sm mb-1">Name (optional)</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-gray-400 text-sm mb-1">Your suggestion *</label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows="6"
                      placeholder="Tell us what's on your mind — product ideas, feature requests, what's working, what isn't…"
                      className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none resize-y"
                    />
                  </div>

                  {status === 'error' && (
                    <div className="bg-red-500/20 border border-red-500 p-4 text-red-400 text-sm">
                      {errorMessage}
                    </div>
                  )}

                  <p className="text-gray-500 text-xs">
                    Submitting also signs you up for occasional product updates and offers. You can unsubscribe anytime.
                  </p>

                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'submitting' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting…
                      </span>
                    ) : (
                      'Send Suggestion'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default SuggestionsPage
