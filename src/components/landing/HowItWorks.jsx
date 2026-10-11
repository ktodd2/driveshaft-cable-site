import React from 'react'

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'DISCONNECT',
      description: 'Remove or disconnect the driveshaft from the vehicle being towed.',
    },
    {
      number: '02',
      title: 'LOOP',
      description: 'Thread the cable through the driveshaft yoke or around the shaft itself.',
    },
    {
      number: '03',
      title: 'SECURE',
      description: 'Attach the cable ends to the frame or crossmember using the aluminum couplers.',
    }
  ]

  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="py-20 md:py-28 bg-ktodd-dark border-t border-gray-800 scroll-mt-32 md:scroll-mt-44">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-12 items-end mb-12">
          <div>
            <p className="eyebrow mb-4">Three Steps</p>
            <h2 id="how-heading" className="text-4xl sm:text-5xl font-industrial text-white">
              HOW IT <span className="text-gradient">WORKS</span>
            </h2>
          </div>
          <p className="text-lg sm:text-xl text-gray-300 lg:justify-self-end">Simple. Fast. Secure.</p>
        </div>

        <ol className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {steps.map((step) => (
            <li key={step.number} className="surface p-7 lg:p-8">
              <div className="text-gradient font-industrial font-bold text-5xl leading-none tabular-nums mb-6" aria-hidden="true">
                {step.number}
              </div>
              <h3 className="text-2xl font-industrial text-white mb-3">
                <span className="sr-only">Step {step.number}: </span>{step.title}
              </h3>
              <p className="text-gray-400">{step.description}</p>
            </li>
          ))}
        </ol>

        {/* Result callout */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-2xl bg-yellow-500/[0.06] ring-1 ring-inset ring-yellow-500/40 p-5 sm:p-6">
          <span className="inline-flex items-center gap-2 font-industrial font-bold tracking-[0.12em] text-yellow-500 flex-none">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            RESULT
          </span>
          <p className="text-white font-industrial text-lg md:text-xl tracking-[0.02em]">
            DRIVESHAFT SAFELY SUSPENDED — NO DRAGGING, NO DAMAGE
          </p>
        </div>

        {/* Video placeholder */}
        <div className="mt-6 surface aspect-video md:aspect-[21/8] flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-16 h-16 bg-yellow-500/10 ring-1 ring-inset ring-yellow-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-yellow-500 ml-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M6.5 4.6v10.8a.6.6 0 00.92.5l8.4-5.4a.6.6 0 000-1l-8.4-5.4a.6.6 0 00-.92.5z" />
              </svg>
            </div>
            <p className="text-gray-400 font-industrial tracking-[0.1em]">INSTALLATION VIDEO COMING SOON</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
