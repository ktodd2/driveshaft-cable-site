import React from 'react'

function Product() {
  return (
    <section id="product" className="py-20 bg-gradient-to-b from-ktodd-dark to-green-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            THE <span className="text-yellow-500">SOLUTION</span>
          </h2>
          <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Purpose-built driveshaft safety cable that keeps the shaft securely suspended — fast, simple, and field-ready.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Product image/illustration */}
          <div className="relative">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-8 industrial-border">
              <svg viewBox="0 0 500 350" className="w-full h-auto">
                <defs>
                  <linearGradient id="cableGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6B7280" />
                    <stop offset="30%" stopColor="#9CA3AF" />
                    <stop offset="70%" stopColor="#9CA3AF" />
                    <stop offset="100%" stopColor="#6B7280" />
                  </linearGradient>
                  <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="30%" stopColor="#F5C800" />
                    <stop offset="70%" stopColor="#D4A017" />
                    <stop offset="100%" stopColor="#B8860B" />
                  </linearGradient>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.4"/>
                  </filter>
                </defs>

                {/* Background glow */}
                <ellipse cx="250" cy="175" rx="180" ry="80" fill="rgba(255,215,0,0.05)" />

                {/* Main cable arc */}
                <path
                  d="M 70 175 Q 250 80 430 175"
                  stroke="url(#cableGrad2)"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  filter="url(#shadow)"
                />

                {/* Cable detail/texture */}
                <path
                  d="M 70 175 Q 250 80 430 175"
                  stroke="#374151"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="6 12"
                />

                {/* Highlight */}
                <path
                  d="M 85 168 Q 250 78 415 168"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="3"
                  fill="none"
                />

                {/* Left Aluminum Coupler */}
                <g filter="url(#shadow)">
                  <rect x="30" y="145" width="60" height="60" rx="6" fill="url(#goldGrad2)" />
                  <rect x="38" y="153" width="44" height="44" rx="4" fill="#B8860B" />
                  <ellipse cx="60" cy="175" rx="14" ry="12" fill="#1A1A1A" />
                  <ellipse cx="60" cy="175" rx="8" ry="6" fill="#374151" />
                </g>

                {/* Right Aluminum Coupler */}
                <g filter="url(#shadow)">
                  <rect x="410" y="145" width="60" height="60" rx="6" fill="url(#goldGrad2)" />
                  <rect x="418" y="153" width="44" height="44" rx="4" fill="#B8860B" />
                  <ellipse cx="440" cy="175" rx="14" ry="12" fill="#1A1A1A" />
                  <ellipse cx="440" cy="175" rx="8" ry="6" fill="#374151" />
                </g>

                {/* Dimension line - length */}
                <line x1="60" y1="260" x2="440" y2="260" stroke="#FFD700" strokeWidth="1" />
                <line x1="60" y1="250" x2="60" y2="270" stroke="#FFD700" strokeWidth="1" />
                <line x1="440" y1="250" x2="440" y2="270" stroke="#FFD700" strokeWidth="1" />
                <text x="250" y="285" textAnchor="middle" fill="#FFD700" fontSize="14" fontFamily="Oswald">1000mm (39")</text>

                {/* Callout - cable */}
                <line x1="250" y1="120" x2="250" y2="60" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="4 2" />
                <text x="250" y="50" textAnchor="middle" fill="#9CA3AF" fontSize="12" fontFamily="Oswald">5/32" STEEL CABLE</text>

                {/* Callout - coupler */}
                <line x1="60" y1="145" x2="60" y2="100" stroke="#FFD700" strokeWidth="1" strokeDasharray="4 2" />
                <text x="60" y="90" textAnchor="middle" fill="#FFD700" fontSize="12" fontFamily="Oswald">ALUMINUM COUPLER</text>
              </svg>
            </div>
          </div>

          {/* Benefits list */}
          <div>
            <h3 className="text-2xl font-industrial text-yellow-500 mb-6">WHY K.TODD DRIVESHAFT CABLE?</h3>

            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-gray-800/50 border-l-4 border-yellow-500">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Prevents Driveshaft Drop</h4>
                  <p className="text-gray-400">Secure suspension keeps the shaft in place during entire transport.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-800/50 border-l-4 border-yellow-500">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Protects Drivetrain Components</h4>
                  <p className="text-gray-400">Eliminates seal damage and secondary transmission failures.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-800/50 border-l-4 border-yellow-500">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Faster Than Makeshift Solutions</h4>
                  <p className="text-gray-400">No more chains, bungees, or zip ties. Install in seconds.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-800/50 border-l-4 border-yellow-500">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Compact & Field-Ready</h4>
                  <p className="text-gray-400">Fits in glove box or tool tray. Always ready when you need it.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-800/50 border-l-4 border-yellow-500">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Reusable & Weather-Resistant</h4>
                  <p className="text-gray-400">Built to last job after job in any conditions.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500">
              <p className="text-yellow-500 font-industrial text-lg">
                ★ DESIGNED BY PEOPLE WHO ACTUALLY TOW TRUCKS
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Product
