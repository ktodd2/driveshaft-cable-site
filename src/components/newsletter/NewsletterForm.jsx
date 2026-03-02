import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

function NewsletterForm({ source = 'homepage', onSuccess, compact = false }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('submitting')
    setErrorMsg('')

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert([{ email: email.trim().toLowerCase(), source }])

    if (error) {
      if (error.code === '23505') {
        // Duplicate email — treat as success
        setStatus('success')
        onSuccess?.()
      } else {
        setStatus('error')
        setErrorMsg('Something went wrong. Please try again.')
        console.error('Newsletter signup error:', error)
      }
      return
    }

    setStatus('success')
    setEmail('')
    onSuccess?.()
  }

  if (status === 'success') {
    return (
      <div className={`text-center ${compact ? 'py-2' : 'py-4'}`}>
        <p className="text-green-400 font-semibold">You're in! Thanks for subscribing.</p>
        <p className="text-gray-400 text-sm mt-1">We'll keep you posted on deals and updates.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'flex gap-2' : 'flex flex-col sm:flex-row gap-3'}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className={`bg-gray-800 border border-gray-700 text-white rounded px-4 py-3 focus:outline-none focus:border-yellow-500 transition-colors ${compact ? 'flex-1 py-2 text-sm' : 'flex-1'}`}
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className={`bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded transition-colors disabled:opacity-50 ${compact ? 'px-4 py-2 text-sm' : 'px-6 py-3'}`}
      >
        {status === 'submitting' ? 'Signing up...' : 'Subscribe'}
      </button>
      {status === 'error' && (
        <p className="text-red-400 text-sm mt-1">{errorMsg}</p>
      )}
    </form>
  )
}

export default NewsletterForm
