import React from 'react'

function Specs() {
  const specs = [
    { label: 'Cable Diameter', value: '5/32"', detail: 'Steel wire cable' },
    { label: 'Total Length', value: '1000mm', detail: '39 inches' },
    { label: 'Working Load Limit', value: '3000 lbs', detail: 'Heavy-duty rated' },
    { label: 'End Construction', value: 'Crimped Loops', detail: 'Secure attachment' },
    { label: 'Coupler Material', value: 'Aluminum', detail: 'Yellow anodized finish' },
    { label: 'Cable Material', value: 'Steel Wire', detail: 'Galvanized for corrosion resistance' },
  ]

  const applications = [
    'Class 7-8 Trucks',
    'Semi-Tractors',
    'Vocational Trucks',
    'Transit Buses',
    'Construction Equipment',
    'Agricultural Equipment',
    'Emergency Vehicles',
    'Military Vehicles'
  ]

  return (
    <section id="specs" aria-labelledby="specs-heading" className="py-20 md:py-28 bg-ktodd-charcoal border-t border-gray-800 scroll-mt-32 md:scroll-mt-44">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-12 items-end mb-12">
          <div>
            <p className="eyebrow mb-4">Specifications</p>
            <h2 id="specs-heading" className="text-4xl sm:text-5xl font-industrial text-white">
              TECHNICAL <span className="text-gradient">SPECIFICATIONS</span>
            </h2>
          </div>
        </div>

        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {specs.map((spec) => (
            <div
              key={spec.label}
              className="surface p-6"
            >
              <dt className="text-gray-400 uppercase text-xs tracking-[0.14em] mb-3">{spec.label}</dt>
              <dd>
                <span className="block text-white text-3xl font-industrial font-bold tabular-nums leading-none mb-2">{spec.value}</span>
                <span className="block text-gray-400 text-sm">{spec.detail}</span>
              </dd>
            </div>
          ))}
        </dl>

        {/* Applications */}
        <div className="mt-6 surface p-6 sm:p-8">
          <h3 className="text-2xl font-industrial text-white mb-6">
            DESIGNED FOR <span className="text-yellow-500">HEAVY-DUTY APPLICATIONS</span>
          </h3>

          <ul className="flex flex-wrap gap-2.5">
            {applications.map((app) => (
              <li
                key={app}
                className="flex items-center gap-2 bg-gray-800 ring-1 ring-inset ring-gray-700 rounded-lg px-3.5 py-2.5"
              >
                <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                <span className="text-gray-200 text-sm">{app}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Safety Warning */}
        <div role="note" className="mt-6 rounded-2xl bg-ember-500/[0.07] ring-1 ring-inset ring-ember-500/40 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-ember-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-ember-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-ember-400 font-industrial text-xl mb-2">SAFETY WARNING</h4>
              <p className="text-gray-200">
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
