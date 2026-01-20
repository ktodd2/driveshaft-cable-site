import React from 'react'

function Customers() {
  const customerTypes = [
    {
      title: 'Heavy-Duty Towing & Recovery',
      description: 'Essential gear for every wrecker and rotator operation.',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      title: 'Fleet Maintenance',
      description: 'Keep your fleet rolling without driveline surprises.',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      title: 'Roadside Service',
      description: 'Quick deployment for emergency recovery situations.',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      title: 'Equipment Transport',
      description: 'Secure driveshafts during long-haul equipment moves.',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      title: 'Municipal & DOT Fleets',
      description: 'Government-grade reliability for public service vehicles.',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      title: 'Rotator Operators',
      description: 'The pros who move the heaviest loads trust purpose-built tools.',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    }
  ]

  return (
    <section className="py-20 bg-ktodd-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            WHO IT'S <span className="text-yellow-500">FOR</span>
          </h2>
          <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Built for professionals who can't afford equipment failures or downtime.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {customerTypes.map((customer, index) => (
            <div
              key={index}
              className="bg-gray-800/30 border border-gray-700 p-6 hover:border-yellow-500 hover:bg-gray-800/50 transition-all duration-300 group"
            >
              <div className="text-yellow-500 mb-4 group-hover:scale-110 transition-transform duration-300">
                {customer.icon}
              </div>
              <h3 className="text-xl font-industrial text-white mb-2">{customer.title}</h3>
              <p className="text-gray-400">{customer.description}</p>
            </div>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-16 pt-12 border-t border-gray-700">
          <div className="text-center mb-8">
            <p className="text-gray-400 uppercase tracking-widest text-sm">Trusted By Professionals</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60">
            <div className="text-gray-400 font-industrial text-lg">HOUSTON TOWING</div>
            <div className="text-gray-400 font-industrial text-lg">GULF COAST RECOVERY</div>
            <div className="text-gray-400 font-industrial text-lg">TEXAS HEAVY HAUL</div>
            <div className="text-gray-400 font-industrial text-lg">LONE STAR WRECKER</div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Customers
