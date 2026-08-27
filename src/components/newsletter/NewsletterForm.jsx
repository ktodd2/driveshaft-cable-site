import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

function NewsletterForm({ source = 'homepage', onSuccess, compact = false }) {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot — humans never fill this
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('submitting')
    setErrorMsg('')

    const { data, error } = await supabase.functions.invoke('newsletter-subscribe', {
      body: { email: email.trim().toLowerCase(), source, website },
    })

    if (error || data?.error) {
      setStatus('error')
      setErrorMsg(data?.error || 'Something went wrong. Please try again.')
      console.error('Newsletter signup error:', error || data?.error)
      return
    }

    setStatus('success')
    setEmail('')
    onSuccess?.()
  }

  if (status === 'success') {
    return (
      <div className={`text-center ${compact ? 'py-2' : 'py-4'}`}>
        <p className="text-green-400 font-semibold">Almost there — check your email!</p>
        <p className="text-gray-400 text-sm mt-1">Click the confirmation link we just sent to finish subscribing.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'flex gap-2' : 'flex flex-col sm:flex-row gap-3'}>
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex="-1"
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
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
