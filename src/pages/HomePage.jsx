import React from 'react'
import Hero from '../components/landing/Hero'
import Problem from '../components/landing/Problem'
import ProductShowcase from '../components/landing/ProductShowcase'
import Specs from '../components/landing/Specs'
import HowItWorks from '../components/landing/HowItWorks'
import Customers from '../components/landing/Customers'
import QuoteForm from '../components/landing/QuoteForm'

function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <ProductShowcase />
      <Specs />
      <HowItWorks />
      <Customers />
      <QuoteForm />
    </>
  )
}

export default HomePage
