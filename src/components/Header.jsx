import React, { useState } from 'react'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-ktodd-dark/95 backdrop-blur-sm border-b border-yellow-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-500 rounded flex items-center justify-center">
              <span className="text-black font-bold text-lg md:text-xl font-industrial">K</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-yellow-500 font-industrial text-lg md:text-xl tracking-wider">DRIVESHAFT CABLE</div>
              <div className="text-gray-400 text-xs tracking-widest">BY K.TODD</div>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#product" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider">Product</a>
            <a href="#specs" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider">Specs</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider">How It Works</a>
            <a href="#quote" className="btn-primary">Get Quote</a>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-700">
            <nav className="flex flex-col gap-4">
              <a href="#product" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider" onClick={() => setIsMenuOpen(false)}>Product</a>
              <a href="#specs" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider" onClick={() => setIsMenuOpen(false)}>Specs</a>
              <a href="#how-it-works" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider" onClick={() => setIsMenuOpen(false)}>How It Works</a>
              <a href="#quote" className="btn-primary text-center" onClick={() => setIsMenuOpen(false)}>Get Quote</a>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
