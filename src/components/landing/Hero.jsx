import React from 'react'

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background with industrial pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-ktodd-dark via-ktodd-charcoal to-ktodd-dark"></div>

      {/* Diagonal warning stripes accent */}
      <div className="absolute top-0 left-0 right-0 h-2 caution-stripe"></div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(rgba(255,215,0,0.1) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,215,0,0.1) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left">
            <div className="inline-block bg-yellow-500/20 border border-yellow-500 px-4 py-1 mb-6">
              <span className="text-yellow-500 uppercase text-sm tracking-widest font-bold">Heavy-Duty Towing Safety</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-industrial text-white mb-4 leading-tight">
              DRIVESHAFT<br />
              <span className="text-yellow-500 glow-yellow">CABLE</span>
            </h1>

            <p className="text-xl sm:text-2xl text-gray-300 font-industrial tracking-wide mb-2">
              BY K.TODD
            </p>

            <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto lg:mx-0">
              Keep the shaft secure. Purpose-built driveshaft suspension cable for heavy-duty towing, recovery, and transport operations.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#quote" className="btn-primary text-lg">
                Request Quote
              </a>
              <a href="#product" className="border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial">
                Learn More
              </a>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4 mt-12 pt-8 border-t border-gray-700">
              <div>
                <div className="text-yellow-500 text-2xl sm:text-3xl font-industrial">5/32"</div>
                <div className="text-gray-500 text-sm uppercase tracking-wider">Steel Cable</div>
              </div>
              <div>
                <div className="text-yellow-500 text-2xl sm:text-3xl font-industrial">39"</div>
                <div className="text-gray-500 text-sm uppercase tracking-wider">Length</div>
              </div>
              <div>
                <div className="text-yellow-500 text-2xl sm:text-3xl font-industrial">2400 lb</div>
                <div className="text-gray-500 text-sm uppercase tracking-wider">Working Limit</div>
              </div>
            </div>
          </div>

          {/* Product Visual */}
          <div className="relative">
            <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-8 industrial-border">
              {/* Product illustration placeholder */}
              <svg viewBox="0 0 400 300" className="w-full h-auto">
                {/* Cable body */}
                <defs>
                  <linearGradient id="cableGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6B7280" />
                    <stop offset="50%" stopColor="#9CA3AF" />
                    <stop offset="100%" stopColor="#6B7280" />
                  </linearGradient>
                  <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="50%" stopColor="#D4A017" />
                    <stop offset="100%" stopColor="#B8860B" />
                  </linearGradient>
                </defs>

                {/* Steel cable */}
                <path
                  d="M 80 150 Q 200 100 320 150"
                  stroke="url(#cableGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Cable texture lines */}
                <path
                  d="M 80 150 Q 200 100 320 150"
                  stroke="#4B5563"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="4 8"
                  strokeLinecap="round"
                />

                {/* Left coupler */}
                <rect x="50" y="130" width="45" height="40" rx="4" fill="url(#goldGradient)" />
                <rect x="55" y="135" width="35" height="30" rx="2" fill="#B8860B" />
                <ellipse cx="72" cy="150" rx="10" ry="8" fill="#1A1A1A" />

                {/* Right coupler */}
                <rect x="305" y="130" width="45" height="40" rx="4" fill="url(#goldGradient)" />
                <rect x="310" y="135" width="35" height="30" rx="2" fill="#B8860B" />
                <ellipse cx="328" cy="150" rx="10" ry="8" fill="#1A1A1A" />

                {/* Highlight shine */}
                <path
                  d="M 90 145 Q 200 95 310 145"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>

              {/* Labels */}
              <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 font-industrial text-sm">
                MADE IN USA
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -bottom-4 -left-4 bg-ktodd-dark border-2 border-yellow-500 px-4 py-2">
              <span className="text-yellow-500 font-industrial">CLASS 7-8 TRUCKS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-2 caution-stripe"></div>
    </section>
  )
}

export default Hero
