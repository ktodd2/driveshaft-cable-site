import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCartStore, selectTotalItems } from '../../stores/cartStore'

const CartIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

// Cart notification popup component
function CartNotification() {
  const notification = useCartStore((state) => state.notification)
  const clearNotification = useCartStore((state) => state.clearNotification)

  if (!notification) return null

  return (
    <div className="fixed top-24 md:top-32 right-4 left-4 sm:left-auto z-50 animate-slide-in" role="status" aria-live="polite">
      <div className="bg-gray-900 rounded-2xl ring-1 ring-yellow-500/50 shadow-2xl shadow-black/60 p-4 sm:max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-ember-500 to-yellow-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-grow">
            <p className="text-white font-bold">Added to Cart!</p>
            <p className="text-gray-400 text-sm tabular-nums">
              {notification.quantity}x {notification.name}
            </p>
          </div>
          <button
            onClick={clearNotification}
            aria-label="Dismiss notification"
            className="-m-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            to="/cart"
            onClick={clearNotification}
            className="btn-primary btn-sm flex-1"
          >
            View Cart
          </Link>
          <button
            onClick={clearNotification}
            className="btn-secondary btn-sm flex-1"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  )
}

const linkBase = 'inline-flex items-center min-h-[44px] px-3 rounded-lg font-industrial uppercase text-[0.9rem] tracking-[0.09em] transition-colors'

function NavLink({ to, children, active, onNavigate, mobile = false }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`${linkBase} ${mobile ? 'min-h-[52px] text-base px-2 border-b border-gray-800' : ''} ${
        active ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500 hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </Link>
  )
}

function CartLink({ totalItems, onNavigate }) {
  return (
    <Link
      to="/cart"
      onClick={onNavigate}
      aria-label={totalItems > 0 ? `Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}` : 'Cart'}
      className="relative inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-300 hover:text-yellow-500 hover:bg-white/[0.04] transition-colors"
    >
      <CartIcon />
      {totalItems > 0 && (
        <span className="absolute top-0.5 right-0.5 bg-yellow-500 text-black text-[0.7rem] font-bold min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center tabular-nums">
          {totalItems > 9 ? '9+' : totalItems}
        </span>
      )}
    </Link>
  )
}

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()
  const totalItems = useCartStore(selectTotalItems)
  const menuButtonRef = useRef(null)

  const isHomePage = location.pathname === '/'
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  const closeMenu = () => setIsMenuOpen(false)

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => { setIsMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!isMenuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isMenuOpen])

  const specsLink = (mobile) => (isHomePage ? (
    <a
      href="#specs"
      onClick={closeMenu}
      className={`${linkBase} ${mobile ? 'min-h-[52px] text-base px-2 border-b border-gray-800' : ''} text-gray-300 hover:text-yellow-500 hover:bg-white/[0.04]`}
    >
      Specs
    </a>
  ) : (
    <NavLink to="/#specs" onNavigate={closeMenu} mobile={mobile}>Specs</NavLink>
  ))

  const links = [
    ['/about', 'About'],
    ['/instructions', 'Instructions'],
    ['/faq', 'FAQ'],
    ['/blog', 'Blog'],
  ]

  return (
    <>
      <CartNotification />
      <header className="bg-ktodd-dark/90 backdrop-blur-md backdrop-saturate-150 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-6 h-24 md:h-32">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-none rounded-lg" aria-label="Driveshaft Cable home">
              <img
                src="/logos/main-logo.png"
                alt="Driveshaft Cable"
                className="h-20 md:h-28 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Primary" className="hidden md:flex items-center gap-1 lg:gap-2">
              <NavLink to="/products" active={isActive('/products')} onNavigate={closeMenu}>Shop</NavLink>
              {specsLink(false)}
              {links.map(([to, label]) => (
                <NavLink key={to} to={to} active={isActive(to)} onNavigate={closeMenu}>{label}</NavLink>
              ))}

              <span className="mx-1 lg:mx-2 h-6 w-px bg-gray-700" aria-hidden="true" />
              <CartLink totalItems={totalItems} />

              <Link to="/quote" className="btn-primary btn-sm ml-2">Get Quote</Link>
            </nav>

            {/* Mobile: Cart + Menu button */}
            <div className="md:hidden flex items-center gap-1">
              <CartLink totalItems={totalItems} onNavigate={closeMenu} />

              <button
                ref={menuButtonRef}
                type="button"
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-white ring-1 ring-inset ring-gray-700 hover:ring-yellow-500/60 transition-shadow"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-nav"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div id="mobile-nav" className="md:hidden pb-5 border-t border-gray-800 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <nav aria-label="Mobile" className="flex flex-col pt-2">
                <NavLink to="/products" active={isActive('/products')} onNavigate={closeMenu} mobile>Shop</NavLink>
                {specsLink(true)}
                {links.map(([to, label]) => (
                  <NavLink key={to} to={to} active={isActive(to)} onNavigate={closeMenu} mobile>{label}</NavLink>
                ))}
                <NavLink to="/contact" active={isActive('/contact')} onNavigate={closeMenu} mobile>Contact</NavLink>
                <Link to="/quote" className="btn-primary mt-4" onClick={closeMenu}>Get Quote</Link>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  )
}

export default Header
