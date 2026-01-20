import React from 'react'
import { Link } from 'react-router-dom'

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-ktodd-dark border-t border-gray-800">
      {/* Caution stripe */}
      <div className="h-2 caution-stripe"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500 rounded flex items-center justify-center">
                <span className="text-black font-bold text-lg font-industrial">K</span>
              </div>
              <div>
                <div className="text-yellow-500 font-industrial text-lg tracking-wider">DRIVESHAFT CABLE</div>
                <div className="text-gray-400 text-xs tracking-widest">BY K.TODD</div>
              </div>
            </Link>
            <p className="text-gray-400 text-sm">
              Heavy-duty driveshaft safety cable for professional towing and recovery operations. Designed in Houston, TX.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-white font-industrial text-lg mb-4">SHOP</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/products" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm">All Products</Link>
              </li>
              <li>
                <Link to="/cart" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm">Cart</Link>
              </li>
              <li>
                <Link to="/quote" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm">Request Quote</Link>
              </li>
              <li>
                <Link to="/order-tracking" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm">Track Order</Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-industrial text-lg mb-4">COMPANY</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm">About Us</Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm">Contact</Link>
              </li>
              <li>
                <Link to="/faq" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm">FAQ</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-industrial text-lg mb-4">CONTACT</h4>
            <div className="space-y-3">
              <a href="mailto:houstontruckwreck@gmail.com" className="flex items-center gap-3 text-gray-400 hover:text-yellow-500 transition-colors text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                houstontruckwreck@gmail.com
              </a>
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Houston, Texas, USA
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © {currentYear} K.Todd. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-gray-500 text-sm">
            <span>MADE IN USA</span>
            <span>•</span>
            <span>HOUSTON, TX</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
