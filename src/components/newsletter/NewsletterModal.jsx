import React, { useState, useEffect } from 'react'
import NewsletterForm from './NewsletterForm'

const STORAGE_KEY = 'ktodd-newsletter-modal-dismissed'

function NewsletterModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(STORAGE_KEY)) return

    // Wait 5 seconds before arming the exit-intent listener
    const armTimeout = setTimeout(() => {
      const handleMouseLeave = (e) => {
        // Trigger when mouse moves above the viewport top
        if (e.clientY <= 0) {
          setShow(true)
          document.removeEventListener('mouseout', handleMouseLeave)
        }
      }
      document.addEventListener('mouseout', handleMouseLeave)

      return () => document.removeEventListener('mouseout', handleMouseLeave)
    }, 5000)

    return () => clearTimeout(armTimeout)
  }, [])

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
  }

  const handleSuccess = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
    // Keep modal open briefly to show success message
    setTimeout(() => setShow(false), 2000)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Yellow accent bar */}
        <div className="w-12 h-1 bg-yellow-500 rounded mb-6" />

        <h3 className="text-2xl font-industrial text-white tracking-wider mb-2">
          WAIT — DON'T MISS OUT
        </h3>
        <p className="text-gray-400 mb-6">
          Join our mailing list for exclusive deals, restocking alerts, and heavy-duty towing tips.
        </p>

        <NewsletterForm source="exit_intent" onSuccess={handleSuccess} />

        <p className="text-gray-600 text-xs mt-4 text-center">No spam. Unsubscribe anytime.</p>
      </div>
    </div>
  )
}

export default NewsletterModal
