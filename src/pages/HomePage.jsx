import React from 'react'
import Hero from '../components/landing/Hero'
import Problem from '../components/landing/Problem'
import ProductShowcase from '../components/landing/ProductShowcase'
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
      email: 'houstontruckwreck@gmail.com',
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
      <Hero />
      <Problem />
      <ProductShowcase />
      <Specs />
      <HowItWorks />
      <Customers />
      <NewsletterInline source="homepage" />
      <QuoteForm />
    </>
  )
}

export default HomePage
