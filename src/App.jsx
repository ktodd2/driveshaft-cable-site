import React from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Problem from './components/Problem'
import Product from './components/Product'
import Specs from './components/Specs'
import HowItWorks from './components/HowItWorks'
import Customers from './components/Customers'
import QuoteForm from './components/QuoteForm'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-ktodd-dark">
      <Header />
      <main>
        <Hero />
        <Problem />
        <Product />
        <Specs />
        <HowItWorks />
        <Customers />
        <QuoteForm />
      </main>
      <Footer />
    </div>
  )
}

export default App
