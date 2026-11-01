import React from 'react'
import { Link } from 'react-router-dom'

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'LIFT AND SUPPORT',
      description: 'Lift the disconnected driveshaft and select a cable length that spans your setup.',
    },
    {
      number: '02',
      title: 'ROUTE CLEAR',
      description: 'Keep the disconnected shaft away from the spinning yoke and rotating hardware.',
    },
    {
      number: '03',
      title: 'CHECK RETENTION',
      description: 'Follow the full tie-up instructions to check forward retention and clearance before towing.',
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
          <p className="text-lg sm:text-xl text-gray-300 lg:justify-self-end">Check routing, retention and clearance.</p>
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
            CHECK YOUR TIE-UP AND CLEARANCE BEFORE TOWING
          </p>
        </div>

        <p className="mt-4 text-gray-300 text-sm">This is a brief overview. <Link to="/instructions" className="text-yellow-400 underline underline-offset-4">Read the full driveshaft tie-up instructions</Link>. Cables are single-use: cut off and discard after each job.</p>

        {/* Installation video (portrait, filmed on a phone) */}
        <figure className="mt-6 surface p-4 sm:p-6 flex flex-col items-center">
          <figcaption className="eyebrow mb-4">Installation Video</figcaption>
          <video
            className="w-full max-w-sm max-h-[80vh] aspect-[9/16] rounded-xl bg-black object-contain"
            src="/videos/installation.mp4"
            poster="/videos/installation-poster.jpg"
            controls
            playsInline
            preload="metadata"
          >
            Your browser does not support embedded video.
          </video>
        </figure>
      </div>
    </section>
  )
}

export default HowItWorks
