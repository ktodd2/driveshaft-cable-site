import React from 'react'
import { Link } from 'react-router-dom'

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

            <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto lg:mx-0 mt-4">
              Keep the shaft secure. Purpose-built driveshaft suspension cable for heavy-duty towing, recovery, and transport operations.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/products" className="btn-primary text-lg">
                Shop Now
              </Link>
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
                <div className="text-yellow-500 text-2xl sm:text-3xl font-industrial">3000 lbs</div>
                <div className="text-gray-500 text-sm uppercase tracking-wider">Working Limit</div>
              </div>
            </div>
          </div>

          {/* Product Visual */}
          <div className="relative">
            <div className="relative rounded-lg overflow-hidden industrial-border">
              <img
                src="/inuse.jpeg"
                alt="Driveshaft Cable installed on vehicle"
                className="w-full h-auto object-cover"
              />
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
