import React from 'react'
import Hero from '../components/landing/Hero'
import Problem from '../components/landing/Problem'
import StorefrontProducts from '../components/landing/StorefrontProducts'
import Specs from '../components/landing/Specs'
import HowItWorks from '../components/landing/HowItWorks'
import Customers from '../components/landing/Customers'
import QuoteForm from '../components/landing/QuoteForm'
import NewsletterInline from '../components/newsletter/NewsletterInline'
import SEOHead from '../components/common/SEOHead'

const homeStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Driveshaft Cable',
    url: 'https://driveshaftcable.com',
    description: 'Driveshaft Cable manufactures heavy-duty driveshaft safety cables (driveshaftcable) for professional towing and recovery operations. Made by a heavy duty operator for the heavy duty operator.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'kurtis@k-todd.com',
      contactType: 'customer service'
    }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Driveshaft Cable',
    url: 'https://driveshaftcable.com',
    description: 'Heavy-duty driveshaft cable for towing and recovery operations',
    publisher: {
      '@type': 'Organization',
      name: 'Driveshaft Cable'
    }
  }
]

function HomePage() {
  return (
    <>
      <SEOHead
        title="Heavy-Duty Driveshaft Safety Cable for Towing"
        description="Driveshaft Cable — 3000lb WLL galvanized steel safety cable for heavy-duty towing. Made by a heavy duty operator for the heavy duty operator. Starting at $3.45/unit."
        keywords="driveshaft cable, driveshaftcable, driveshaft safety cable, towing safety cable, heavy duty towing cable, driveshaft guard cable"
        canonical="/"
        structuredData={homeStructuredData}
      />
      {/* Products grid renders first — customers see the catalogue the
          moment they land on the homepage. Hero and the rest of the
          marketing content sit below. */}
      {/* pt clears the fixed header (same offset every page uses), so the
          storefront heading is never tucked under the nav. */}
      <div className="pt-24 md:pt-32">
        {/* Shipping rate change notice */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div role="note" className="rounded-2xl bg-yellow-500/[0.07] ring-1 ring-inset ring-yellow-500/40 p-5 sm:p-6">
            <h2 className="text-yellow-400 font-industrial text-lg tracking-[0.06em] mb-2">A Note About Shipping Rates</h2>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
              Carrier shipping costs have gone up considerably, and we've had to adjust our rates to keep up.
              Orders over <span className="text-white font-semibold">$600</span> still ship <span className="text-yellow-400 font-semibold">FREE</span>.
              Orders under $600 now ship for a <span className="text-white font-semibold">$20 flat rate</span> anywhere in the U.S.
              We've held off as long as we could — thank you for your understanding and for your continued business.
            </p>
          </div>
        </div>
        <StorefrontProducts />
      </div>
      <Hero />
      <Problem />
      <Specs />
      <HowItWorks />
      <Customers />
      <NewsletterInline source="homepage" />
      <QuoteForm />
    </>
  )
}

export default HomePage
