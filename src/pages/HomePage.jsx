import React from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/landing/Hero'
import Problem from '../components/landing/Problem'
import StorefrontProducts from '../components/landing/StorefrontProducts'
import Specs from '../components/landing/Specs'
import HowItWorks from '../components/landing/HowItWorks'
import Customers from '../components/landing/Customers'
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
      email: 'admin@driveshaftcable.com',
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
        description="Shop Standard and XL driveshaft cables for heavy-duty towing and recovery. Compare lengths, view current volume pricing, and order online."
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
        <StorefrontProducts compactIntro />
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
      </div>
      <Hero />
      <Problem />
      <Specs />
      <HowItWorks />
      <Customers />
      <NewsletterInline source="homepage" />
      <section id="quote" aria-labelledby="home-order-heading" className="py-12 md:py-16 bg-ktodd-charcoal border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="home-order-heading" className="text-3xl sm:text-4xl font-industrial text-white mb-4">READY TO <span className="text-yellow-500">ORDER?</span></h2>
          <p className="text-gray-300 max-w-2xl mb-6">Order online with automatic volume pricing. For dealer, fleet or special-order requests, visit our quote page.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Link to="/products" className="btn-primary">Shop Cables</Link>
            <Link to="/quote" className="btn-secondary">Bulk / Dealer Quote</Link>
          </div>
        </div>
      </section>
    </>
  )
}

export default HomePage
