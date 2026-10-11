import React from 'react'
import { Link } from 'react-router-dom'

// Static, exact values. Never animated: these must read correctly in every
// frame, screenshot and reduced-motion setting.
const quickSpecs = [
  { label: 'Steel Cable', value: '5/32"' },
  { label: 'Length', value: '39"' },
  { label: 'Working Limit', value: '3000 lbs' },
  { label: 'Built for', value: 'Class 7-8' },
]

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden section-glow border-t border-gray-800">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
          {/* Text Content. The storefront grid above owns the page h1, so this
              display heading is an h2 styled at display size. */}
          <div className="text-left">
            <p className="eyebrow mb-5">Heavy-Duty Towing Safety</p>

            <h2 id="hero-heading" className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-industrial font-bold text-white mb-6 leading-[0.95]">
              DRIVESHAFT<br />
              <span className="text-gradient">CABLE</span>
            </h2>

            <p className="text-lg text-gray-300 mb-8 max-w-xl leading-relaxed">
              Keep the shaft secure. Purpose-built driveshaft suspension cable for heavy-duty towing, recovery, and transport operations. Now in two coupler configurations — pick the one that fits your driveline geometry.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/products" className="btn-primary text-base">
                Shop Now
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <a href="#specs" className="btn-secondary text-base">
                Learn More
              </a>
            </div>
          </div>

          {/* Product Visual */}
          <figure className="photo-frame">
            <img
              src="/inuse.jpeg"
              alt="Driveshaft Cable installed on vehicle"
              className="w-full aspect-[4/3] lg:aspect-[4/5] object-cover"
              width="900"
              height="1200"
            />
            <figcaption className="absolute left-0 right-0 bottom-0 px-5 pb-4 pt-12 bg-gradient-to-t from-black/85 to-transparent text-sm text-gray-200">
              <span className="font-industrial tracking-[0.12em] text-yellow-500 mr-2">CLASS 7-8 TRUCKS</span>
            </figcaption>
          </figure>
        </div>

        {/* Spec bar */}
        <dl className="mt-14 grid grid-cols-2 lg:grid-cols-4 surface overflow-hidden" aria-label="Key specifications">
          {quickSpecs.map((spec, i) => (
            <div
              key={spec.label}
              className={`p-5 sm:p-6 min-w-0 ${i % 2 === 1 ? 'border-l border-gray-700' : ''} ${i >= 2 ? 'border-t border-gray-700 lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
            >
              <dt className="text-gray-400 text-xs uppercase tracking-[0.14em] mb-2">{spec.label}</dt>
              <dd className="text-white text-2xl sm:text-3xl font-industrial font-bold tabular-nums leading-none">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export default Hero
