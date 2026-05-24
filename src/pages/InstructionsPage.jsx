import React from 'react'
import { Link } from 'react-router-dom'
import SEOHead from '../components/common/SEOHead'

// Swap this with the hosted Supabase URL once the infographic is uploaded
// via the admin image uploader. Falls back gracefully if the file is missing.
const INFOGRAPHIC_URL = '/instructions/driveshaft-tie-up.jpeg'

const howToStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Proper Driveshaft Tie-Up',
  description: 'Keep the disconnected driveshaft away from the spinning yoke and pulled forward to prevent slip-out during towing.',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Lift and secure the shaft up',
      text: 'Raise the disconnected driveshaft and tie it up so it stays clear of the moving driveline components below it.',
    },
    {
      '@type': 'HowToStep',
      name: 'Tie away from moving parts',
      text: 'Route the cable so the shaft is held away from the spinning yoke and any rotating hardware.',
    },
    {
      '@type': 'HowToStep',
      name: 'Pull forward so the shaft cannot slip out',
      text: 'Apply forward tension on the cable to keep the slip-yoke fully engaged and prevent the shaft from sliding out during transport.',
    },
    {
      '@type': 'HowToStep',
      name: 'Check clearance before towing',
      text: 'Walk around the rig and confirm the shaft is well clear of the spinning yoke before you roll.',
    },
  ],
}

function InstructionsPage() {
  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title="Proper Driveshaft Tie-Up Instructions"
        description="How to properly tie up a disconnected driveshaft for towing — keep the shaft clear of the spinning yoke and pull forward to prevent slip-out."
        keywords="driveshaft tie up, driveshaft cable instructions, towing driveshaft safety, disconnected driveshaft, spinning yoke"
        canonical="/instructions"
        structuredData={howToStructuredData}
      />

      {/* Hero */}
      <section className="py-16 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
            PROPER <span className="text-yellow-500">DRIVESHAFT TIE-UP</span>
          </h1>
          <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Keep the shaft away from the spinning yoke and pull it forward to prevent slip-out.
          </p>
        </div>
      </section>

      {/* Infographic */}
      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <figure className="border border-yellow-500/40 bg-black/40 p-2 shadow-lg shadow-yellow-500/10">
            <img
              src={INFOGRAPHIC_URL}
              alt="Proper driveshaft tie-up: lift and secure the shaft up, tie it away from moving parts, pull forward so the shaft cannot slip out, and keep clear of the spinning yoke."
              className="w-full h-auto"
              loading="lazy"
            />
            <figcaption className="text-center text-gray-400 text-sm py-3">
              Field reference — share with your crew.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 bg-ktodd-dark">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-industrial text-white mb-10 text-center">
            STEP BY <span className="text-yellow-500">STEP</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-800/40 border border-gray-700 hover:border-yellow-500 transition-colors p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-black font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-industrial text-white mb-2">LIFT AND SECURE THE SHAFT UP</h3>
                  <p className="text-gray-400">
                    Raise the disconnected driveshaft and tie it up so it stays clear of everything below.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700 hover:border-yellow-500 transition-colors p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-black font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-industrial text-white mb-2">TIE AWAY FROM MOVING PARTS</h3>
                  <p className="text-gray-400">
                    Route the cable so the shaft is held away from the spinning yoke and any rotating hardware.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700 hover:border-yellow-500 transition-colors p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-black font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-industrial text-white mb-2">PULL FORWARD — NO SLIP-OUT</h3>
                  <p className="text-gray-400">
                    Apply forward tension on the cable so the slip-yoke stays engaged and the shaft cannot slide out.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700 hover:border-yellow-500 transition-colors p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-black font-bold">4</span>
                </div>
                <div>
                  <h3 className="text-xl font-industrial text-white mb-2">CHECK CLEARANCE BEFORE TOWING</h3>
                  <p className="text-gray-400">
                    Walk around the rig and confirm the shaft is well clear of the spinning yoke before you roll.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Danger callout */}
      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-500/10 border-2 border-red-500 p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-industrial text-red-400 mb-2">DANGER: KEEP CLEAR OF SPINNING YOKE</h3>
              <p className="text-gray-300">
                Never let the disconnected shaft contact the spinning yoke. If the shaft drops into it during a tow,
                you can lose the driveline, damage seals and transmission components, or throw debris at traffic.
                When in doubt, stop and re-tie.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick checklist */}
      <section className="py-16 bg-ktodd-dark">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-black/40 border border-yellow-500/40 p-8">
            <h2 className="text-2xl font-industrial text-yellow-500 mb-6">QUICK CHECKLIST</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-gray-200">
                <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Hold shaft away from the yoke</span>
              </li>
              <li className="flex items-start gap-3 text-gray-200">
                <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Apply forward pull</span>
              </li>
              <li className="flex items-start gap-3 text-gray-200">
                <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Check clearance before towing</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-yellow-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-industrial text-black mb-4">
            NEED THE CABLE FOR THE JOB?
          </h2>
          <p className="text-lg text-black/80 mb-8">
            Purpose-built 5/32" galvanized steel with aluminum couplers. One job, one cable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/products" className="bg-black text-yellow-500 hover:bg-gray-900 font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial">
              Shop Now
            </Link>
            <Link to="/faq" className="border-2 border-black text-black hover:bg-black hover:text-yellow-500 font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial">
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default InstructionsPage
