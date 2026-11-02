import React, { useState, useEffect, useRef, useId } from 'react'
import NewsletterForm from './NewsletterForm'

const STORAGE_KEY = 'ktodd-newsletter-modal-dismissed'

function NewsletterModal() {
  const [show, setShow] = useState(false)
  const dialogRef = useRef(null)
  const headingId = useId()

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(STORAGE_KEY)) return

    const handleMouseLeave = (e) => {
      if (e.clientY <= 0) {
        setShow(true)
        document.removeEventListener('mouseout', handleMouseLeave)
      }
    }
    const armTimeout = setTimeout(() => {
      document.addEventListener('mouseout', handleMouseLeave)
    }, 5000)
    return () => {
      clearTimeout(armTimeout)
      document.removeEventListener('mouseout', handleMouseLeave)
    }
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

  useEffect(() => {
    if (!show || !dialogRef.current) return undefined
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [show])

  if (!show) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={(e) => { e.preventDefault(); handleDismiss() }}
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss() }}
      className="bg-transparent p-4 max-w-lg w-full backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Close newsletter signup"
          className="absolute top-2 right-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Yellow accent bar */}
        <div className="w-12 h-1 bg-yellow-500 rounded mb-6" />

        <h3 id={headingId} className="text-2xl font-industrial text-white tracking-wider mb-2">
          WAIT — DON'T MISS OUT
        </h3>
        <p className="text-gray-400 mb-6">
          Join our mailing list for exclusive deals, restocking alerts, and heavy-duty towing tips.
        </p>

        <NewsletterForm source="exit_intent" onSuccess={handleSuccess} />

        <p className="text-gray-400 text-xs mt-4 text-center">No spam. Unsubscribe anytime.</p>
      </div>
    </dialog>
  )
}

export default NewsletterModal
