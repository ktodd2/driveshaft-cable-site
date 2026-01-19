import React from 'react'

function Problem() {
  return (
    <section className="py-20 bg-gradient-to-b from-ktodd-dark to-red-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            THE <span className="text-red-500">PROBLEM</span>
          </h2>
          <div className="w-24 h-1 bg-red-500 mx-auto"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Problem description */}
          <div>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Loose or unsupported driveshafts during towing and recovery operations create serious hazards and costly damage.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 border border-red-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Unexpected Driveshaft Drop</h3>
                  <p className="text-gray-400">Unsecured shafts can drop during transport, causing road hazards and equipment damage.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 border border-red-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Transmission & Seal Damage</h3>
                  <p className="text-gray-400">Dragging driveshafts can destroy seals and damage transmission components.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 border border-red-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Costly Secondary Failures</h3>
                  <p className="text-gray-400">What starts as a simple tow can become a $10,000+ repair bill.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 border border-red-500 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Safety Hazards</h3>
                  <p className="text-gray-400">Personnel injuries from falling driveshafts during recovery operations.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Warning box */}
          <div className="bg-red-950/50 border-2 border-red-500 p-8 relative">
            <div className="absolute -top-4 left-8 bg-red-500 text-white px-4 py-1 font-industrial">
              WARNING
            </div>
            <div className="mt-4">
              <p className="text-xl text-white font-industrial mb-4">
                UNSECURED DRIVESHAFTS DURING TOWING CAN RESULT IN:
              </p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center gap-3">
                  <span className="text-red-500 font-bold">&#10007;</span>
                  Equipment damage exceeding $15,000
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-red-500 font-bold">&#10007;</span>
                  Extended vehicle downtime
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-red-500 font-bold">&#10007;</span>
                  Liability claims from road incidents
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-red-500 font-bold">&#10007;</span>
                  Worker injury risks
                </li>
              </ul>

              <div className="mt-8 pt-6 border-t border-red-500/30">
                <p className="text-gray-400 italic">
                  "Makeshift solutions like bungee cords and zip ties aren't built for heavy-duty applications."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Problem
