import React from 'react'
import NewsletterForm from './NewsletterForm'

function InlineNewsletterCTA() {
  return (
    <div className="my-10 p-6 border-2 border-yellow-500/30 bg-yellow-500/5 rounded">
      <div className="flex items-start gap-4">
        <div className="hidden sm:flex flex-shrink-0 w-12 h-12 bg-yellow-500 rounded items-center justify-center">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-industrial text-lg mb-1">GET TOWING TIPS IN YOUR INBOX</h3>
          <p className="text-gray-400 text-sm mb-3">
            Join operators who get weekly safety tips, equipment reviews, and industry updates. No spam.
          </p>
          <NewsletterForm source="blog-inline" compact />
        </div>
      </div>
    </div>
  )
}

export default InlineNewsletterCTA
