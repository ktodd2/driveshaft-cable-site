import React, { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Landing page hit from the double-opt-in confirmation email
// (/newsletter/confirm?token=...). Posts the token to the newsletter-confirm
// edge function, which activates the subscriber and starts the welcome series.
function NewsletterConfirmPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const requested = useRef(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('This confirmation link is missing its token. Try the link from your email again.')
      return
    }
    // React 18 StrictMode double-mounts effects; the token is single-use, so
    // make sure only one confirm request goes out.
    if (requested.current) return
    requested.current = true

    const confirm = async () => {
      const { data, error } = await supabase.functions.invoke('newsletter-confirm', {
        body: { token },
      })
      if (error || data?.error) {
        setStatus('error')
        setErrorMsg(data?.error || 'This confirmation link is invalid or has already been used.')
        return
      }
      setStatus('success')
    }

    confirm()
  }, [token])

  return (
    <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        {status === 'loading' && (
          <>
            <h1 className="text-3xl font-industrial text-white mb-4">CONFIRMING...</h1>
            <p className="text-gray-400">One moment while we confirm your subscription.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-3xl font-industrial text-white mb-4">
              YOU'RE <span className="text-yellow-500">IN</span>
            </h1>
            <p className="text-gray-400 mb-8">
              Your subscription is confirmed. Keep an eye on your inbox — your welcome email
              (with a 5% off code) is on its way.
            </p>
            <Link to="/products" className="btn-primary">Browse Products</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-3xl font-industrial text-white mb-4">
              LINK <span className="text-red-500">INVALID</span>
            </h1>
            <p className="text-gray-400 mb-8">{errorMsg}</p>
            <Link to="/" className="btn-primary">Back to Home</Link>
          </>
        )}
      </div>
    </div>
  )
}

export default NewsletterConfirmPage
