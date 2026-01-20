import React from 'react'

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'DISCONNECT',
      description: 'Remove or disconnect the driveshaft from the vehicle being towed.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      number: '02',
      title: 'LOOP',
      description: 'Thread the cable through the driveshaft yoke or around the shaft itself.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    },
    {
      number: '03',
      title: 'SECURE',
      description: 'Attach the cable ends to the frame or crossmember using the aluminum couplers.',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    }
  ]

  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-b from-ktodd-charcoal to-ktodd-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            HOW IT <span className="text-yellow-500">WORKS</span>
          </h2>
          <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
          <p className="text-xl text-gray-400">Simple. Fast. Secure.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line (hidden on mobile, shown between items on desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-500/20"></div>
              )}

              <div className="relative bg-gray-800/50 border border-gray-700 p-8 text-center hover:border-yellow-500 transition-all duration-300 group">
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black font-industrial text-xl px-4 py-1">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="text-yellow-500 mb-6 flex justify-center group-hover:scale-110 transition-transform duration-300">
                  {step.icon}
                </div>

                {/* Content */}
                <h3 className="text-2xl font-industrial text-white mb-4">{step.title}</h3>
                <p className="text-gray-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Result callout */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-green-500/20 border-2 border-green-500 px-8 py-4">
            <p className="text-green-400 font-industrial text-xl md:text-2xl">
              ✓ DRIVESHAFT SAFELY SUSPENDED — NO DRAGGING, NO DAMAGE
            </p>
          </div>
        </div>

        {/* Video placeholder */}
        <div className="mt-16 bg-gray-800 border border-gray-700 aspect-video max-w-4xl mx-auto flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-yellow-500/20 border-2 border-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-yellow-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-400 font-industrial">INSTALLATION VIDEO COMING SOON</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
