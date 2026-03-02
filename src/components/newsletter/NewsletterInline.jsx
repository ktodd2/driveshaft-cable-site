import React from 'react'
import NewsletterForm from './NewsletterForm'

function NewsletterInline({ source = 'homepage' }) {
  return (
    <section className="bg-gray-900 border-t border-b border-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-industrial text-white tracking-wider mb-3">
          STAY IN THE LOOP
        </h2>
        <p className="text-gray-400 mb-6 max-w-lg mx-auto">
          Get exclusive deals, product updates, and heavy-duty towing tips delivered to your inbox.
        </p>
        <div className="max-w-md mx-auto">
          <NewsletterForm source={source} />
        </div>
        <p className="text-gray-600 text-xs mt-4">No spam, ever. Unsubscribe anytime.</p>
      </div>
    </section>
  )
}

export default NewsletterInline
