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
          {/* Product image */}
          <div className="relative">
            <div className="rounded-lg overflow-hidden industrial-border">
              <img
                src="/inuse.jpeg"
                alt="K.Todd Driveshaft Cable installed on vehicle"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
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
                ★ MADE BY A HEAVY DUTY OPERATOR FOR THE HEAVY DUTY OPERATOR
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Product
