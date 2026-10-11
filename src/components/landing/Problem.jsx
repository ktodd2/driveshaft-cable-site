import React from 'react'

const risks = [
  {
    title: 'Unexpected Driveshaft Drop',
    body: 'Unsecured shafts can drop during transport, causing road hazards and equipment damage.',
  },
  {
    title: 'Transmission & Seal Damage',
    body: 'Dragging driveshafts can destroy seals and damage transmission components.',
  },
  {
    title: 'Costly Secondary Failures',
    body: 'What starts as a simple tow can become a $10,000+ repair bill.',
  },
  {
    title: 'Safety Hazards',
    body: 'Personnel injuries from falling driveshafts during recovery operations.',
  },
]

const outcomes = [
  'Equipment damage exceeding $15,000',
  'Extended vehicle downtime',
  'Liability claims from road incidents',
  'Worker injury risks',
]

function Problem() {
  return (
    <section aria-labelledby="problem-heading" className="py-20 md:py-28 bg-ktodd-dark border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-12 items-end mb-12">
          <div>
            <p className="eyebrow mb-4">Why It Matters</p>
            <h2 id="problem-heading" className="text-4xl sm:text-5xl font-industrial text-white">
              THE <span className="text-gradient">PROBLEM</span>
            </h2>
          </div>
          <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-xl">
            Loose or unsupported driveshafts during towing and recovery operations create serious hazards and costly damage.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 lg:gap-6 items-stretch">
          {/* Problem description */}
          <div>
            <ol className="surface overflow-hidden divide-y divide-gray-700">
              {risks.map((risk, i) => (
                <li key={risk.title} className="grid grid-cols-[2.75rem_1fr] gap-4 p-5 sm:p-6">
                  <span className="font-industrial font-bold text-lg text-ember-400 tabular-nums leading-7" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-lg font-industrial tracking-[0.04em] text-white mb-1">{risk.title}</h3>
                    <p className="text-gray-400">{risk.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Warning box */}
          <div className="relative rounded-2xl bg-gradient-to-br from-ember-500/[0.12] to-transparent ring-1 ring-inset ring-ember-500/40 p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 rounded-full bg-ember-500 text-black px-3 py-1 text-xs font-bold font-industrial tracking-[0.14em]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              WARNING
            </p>
            <p className="mt-5 text-xl text-white font-industrial mb-5">
              UNSECURED DRIVESHAFTS DURING TOWING CAN RESULT IN:
            </p>
            <ul className="space-y-3 text-gray-200">
              {outcomes.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg className="mt-1 w-4 h-4 flex-shrink-0 text-ember-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <blockquote className="mt-8 pt-6 border-t border-ember-500/25">
              <p className="text-gray-100 text-lg italic leading-relaxed">
                &ldquo;Makeshift solutions like bungee cords and zip ties aren&apos;t built for heavy-duty applications.&rdquo;
              </p>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Problem
