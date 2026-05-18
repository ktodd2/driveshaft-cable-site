import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SEOHead from '../components/common/SEOHead'

function defaultDisplayName(fullName) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  const first = parts[0]
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  return `${first} ${lastInitial}.`
}

function TestimonialPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState(null)
  const [state, setState] = useState('form')  // form | submitting | success | error | expired | already | missing
  const [text, setText] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [consent, setConsent] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setState('missing')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('customer_name, customer_email, status, expires_at')
        .eq('token', token)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setState('missing')
      } else if (data.status !== 'pending') {
        setState('already')
        setRow(data)
      } else if (new Date(data.expires_at) < new Date()) {
        setState('expired')
        setRow(data)
      } else {
        setRow(data)
        setDisplayName(defaultDisplayName(data.customer_name))
        setState('form')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!consent) {
      setErrorMessage('Please confirm permission to use your testimonial in promotional materials.')
      return
    }
    if (!text.trim()) return
    setState('submitting')
    setErrorMessage('')

    const { error } = await supabase
      .from('testimonials')
      .update({
        testimonial_text: text.trim(),
        display_name: displayName.trim() || defaultDisplayName(row.customer_name),
        consented_to_promo: true,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
      })
      .eq('token', token)
      .eq('status', 'pending')

    if (error) {
      console.error('Testimonial submit failed:', error)
      setState('error')
      setErrorMessage('Something went wrong. Please try again, or reply to the email directly.')
      return
    }

    setState('success')
  }

  if (loading) {
    return (
      <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark flex items-center justify-center">
        <p className="text-yellow-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
      <SEOHead title="Leave a Testimonial" noindex canonical="/testimonial" />

      <section className="py-12 bg-ktodd-dark border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-2">
            HOW'S YOUR <span className="text-yellow-500">CABLE?</span>
          </h1>
          <div className="w-24 h-1 bg-yellow-500 mb-4"></div>
          <p className="text-gray-400 text-lg">
            A quick honest sentence or two helps other operators know what they're getting.
          </p>
        </div>
      </section>

      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800/50 border border-gray-700 p-6 md:p-8">

            {state === 'success' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-industrial text-white mb-3">THANKS!</h3>
                <p className="text-gray-400 mb-6">
                  Your testimonial is in. We may feature it on our site, social media, or marketing emails — credited as <span className="text-yellow-500">{displayName.trim() || defaultDisplayName(row?.customer_name)}</span>.
                </p>
                <Link to="/" className="text-yellow-500 hover:text-yellow-400 underline">Back to Driveshaft Cable</Link>
              </div>
            )}

            {state === 'expired' && (
              <div className="text-center py-8">
                <h3 className="text-2xl font-industrial text-white mb-3">LINK EXPIRED</h3>
                <p className="text-gray-400 mb-6">
                  This testimonial link has expired. If you'd still like to share your experience, please reply to the email or contact us directly.
                </p>
                <a href="mailto:houstontruckwreck@gmail.com" className="text-yellow-500 hover:text-yellow-400 underline">
                  houstontruckwreck@gmail.com
                </a>
              </div>
            )}

            {state === 'already' && (
              <div className="text-center py-8">
                <h3 className="text-2xl font-industrial text-white mb-3">ALREADY SUBMITTED</h3>
                <p className="text-gray-400 mb-6">
                  Looks like this testimonial has already been sent in. Thanks again!
                </p>
                <Link to="/" className="text-yellow-500 hover:text-yellow-400 underline">Back to Driveshaft Cable</Link>
              </div>
            )}

            {state === 'missing' && (
              <div className="text-center py-8">
                <h3 className="text-2xl font-industrial text-white mb-3">LINK NOT FOUND</h3>
                <p className="text-gray-400 mb-6">
                  This link isn't valid. If you got here from a recent email and think it's a mistake, please reply to the email directly.
                </p>
                <Link to="/" className="text-yellow-500 hover:text-yellow-400 underline">Back to Driveshaft Cable</Link>
              </div>
            )}

            {(state === 'form' || state === 'submitting' || state === 'error') && row && (
              <>
                <h2 className="text-2xl font-industrial text-yellow-500 mb-6">SHARE YOUR EXPERIENCE</h2>

                <p className="text-gray-400 text-sm mb-6">
                  Submitting as <span className="text-white">{row.customer_email}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="text" className="block text-gray-400 text-sm mb-1">Your experience *</label>
                    <textarea
                      id="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      required
                      rows="6"
                      placeholder="A sentence or two about how the cable's held up, what you liked, what you'd want different…"
                      className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none resize-y"
                    />
                  </div>

                  <div>
                    <label htmlFor="displayName" className="block text-gray-400 text-sm mb-1">
                      How should we credit you?
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={defaultDisplayName(row.customer_name) || 'Mike S.'}
                      className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Defaulted to first name + last initial. Edit if you want it different (or use just your company).
                    </p>
                  </div>

                  <label className="flex items-start gap-3 text-gray-300 text-sm cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-yellow-500"
                    />
                    <span>
                      I grant Driveshaft Cable permission to use this testimonial (and the credit name above) in promotional materials including the website, social media, and marketing emails.
                    </span>
                  </label>

                  {errorMessage && (
                    <div className="bg-red-500/20 border border-red-500 p-4 text-red-400 text-sm">
                      {errorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={state === 'submitting'}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {state === 'submitting' ? 'Submitting…' : 'Submit Testimonial'}
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

export default TestimonialPage
