import React from 'react'

function Specs() {
  const specs = [
    { label: 'Cable Diameter', value: '5/32"', detail: 'Steel wire cable' },
    { label: 'Total Length', value: '1000mm', detail: '39 inches' },
    { label: 'Working Load Limit', value: '2400 lb', detail: 'Heavy-duty rated' },
    { label: 'End Construction', value: 'Crimped Loops', detail: 'Secure attachment' },
    { label: 'Coupler Material', value: 'Aluminum', detail: 'Yellow anodized finish' },
    { label: 'Cable Material', value: 'Steel Wire', detail: 'Galvanized for corrosion resistance' },
  ]

  return (
    <section id="specs" className="py-20 bg-ktodd-charcoal">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            TECHNICAL <span className="text-yellow-500">SPECIFICATIONS</span>
          </h2>
          <div className="w-24 h-1 bg-yellow-500 mx-auto"></div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {specs.map((spec, index) => (
            <div
              key={index}
              className="bg-gray-800/50 border border-gray-700 p-6 hover:border-yellow-500 transition-colors duration-300"
            >
              <div className="text-gray-400 uppercase text-sm tracking-wider mb-2">{spec.label}</div>
              <div className="text-yellow-500 text-3xl font-industrial mb-1">{spec.value}</div>
              <div className="text-gray-500 text-sm">{spec.detail}</div>
            </div>
          ))}
        </div>

        {/* Applications */}
        <div className="mt-16">
          <h3 className="text-2xl font-industrial text-white mb-8 text-center">
            DESIGNED FOR <span className="text-yellow-500">HEAVY-DUTY APPLICATIONS</span>
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              'Class 7-8 Trucks',
              'Semi-Tractors',
              'Vocational Trucks',
              'Transit Buses',
              'Construction Equipment',
              'Agricultural Equipment',
              'Emergency Vehicles',
              'Military Vehicles'
            ].map((app, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-gray-800/30 px-4 py-3 border-l-2 border-yellow-500"
              >
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-300">{app}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Warning */}
        <div className="mt-16 bg-yellow-500/10 border-2 border-yellow-500 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-yellow-500 font-industrial text-xl mb-2">SAFETY WARNING</h4>
              <p className="text-gray-300">
                Driveshaft must be properly secured prior to towing. Failure to support driveline components may result in equipment damage or personal injury. Always inspect cable before each use. Do not exceed working load limit. Replace if any damage or wear is visible.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Specs
