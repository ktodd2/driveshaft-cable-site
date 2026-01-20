import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCartStore } from '../../stores/cartStore'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()
  const totalItems = useCartStore((state) => state.totalItems)

  const isHomePage = location.pathname === '/'

  const NavLink = ({ to, children, className = '' }) => (
    <Link
      to={to}
      className={`text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider ${className}`}
      onClick={() => setIsMenuOpen(false)}
    >
      {children}
    </Link>
  )

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-ktodd-dark/95 backdrop-blur-sm border-b border-yellow-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-500 rounded flex items-center justify-center">
              <span className="text-black font-bold text-lg md:text-xl font-industrial">K</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-yellow-500 font-industrial text-lg md:text-xl tracking-wider">DRIVESHAFT CABLE</div>
              <div className="text-gray-400 text-xs tracking-widest">BY K.TODD</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <NavLink to="/products">Shop</NavLink>
            {isHomePage ? (
              <a href="#specs" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider">Specs</a>
            ) : (
              <NavLink to="/#specs">Specs</NavLink>
            )}
            <NavLink to="/about">About</NavLink>
            <NavLink to="/faq">FAQ</NavLink>

            {/* Cart Icon */}
            <Link to="/cart" className="relative text-gray-300 hover:text-yellow-500 transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>

            <Link to="/quote" className="btn-primary">Get Quote</Link>
          </nav>

          {/* Mobile: Cart + Menu button */}
          <div className="md:hidden flex items-center gap-2">
            {/* Cart Icon Mobile */}
            <Link to="/cart" className="relative text-gray-300 hover:text-yellow-500 transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>

            <button
              className="text-white p-2"
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
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-700">
            <nav className="flex flex-col gap-4">
              <NavLink to="/products">Shop</NavLink>
              {isHomePage ? (
                <a href="#specs" className="text-gray-300 hover:text-yellow-500 transition-colors uppercase text-sm tracking-wider" onClick={() => setIsMenuOpen(false)}>Specs</a>
              ) : (
                <NavLink to="/#specs">Specs</NavLink>
              )}
              <NavLink to="/about">About</NavLink>
              <NavLink to="/faq">FAQ</NavLink>
              <NavLink to="/contact">Contact</NavLink>
              <Link to="/quote" className="btn-primary text-center" onClick={() => setIsMenuOpen(false)}>Get Quote</Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
