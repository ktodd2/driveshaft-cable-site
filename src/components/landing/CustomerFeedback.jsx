import React, { useEffect, useState } from 'react'
import { usePublicData } from '../../ssg/PublicData'
import { supabase } from '../../lib/supabase'
import { publicTestimonials } from '../../lib/publicTestimonials'

export default function CustomerFeedback() {
  const [quotes, setQuotes] = useState(usePublicData()?.testimonials || [])
  useEffect(() => {
    let active = true
    supabase.rpc('get_public_testimonials')
      .then(({ data, error }) => { if (active) setQuotes(error ? [] : publicTestimonials(data)) })
      .catch(() => { if (active) setQuotes([]) })
    return () => { active = false }
  }, [])
  if (!quotes.length) return null
  return <section aria-labelledby="customer-feedback-heading" className="py-8 md:py-12 bg-ktodd-charcoal border-y border-gray-800">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <p className="eyebrow mb-3">From Our Customers</p>
      <h2 id="customer-feedback-heading" className="text-3xl font-industrial text-white mb-6">CUSTOMER FEEDBACK</h2>
      <div className="grid gap-5 md:grid-cols-2">
        {quotes.map(quote => <figure key={quote.id} className="rounded-xl bg-black/30 border border-gray-700 p-6">
          <blockquote className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">“{quote.testimonial_text}”</blockquote>
          <figcaption className="text-yellow-400 font-semibold mt-4">— {quote.display_name}</figcaption>
        </figure>)}
      </div>
    </div>
  </section>
}
