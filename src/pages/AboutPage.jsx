import React from 'react'
import { Link } from 'react-router-dom'

function AboutPage() {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
              ABOUT <span className="text-yellow-500">K.TODD</span>
            </h1>
            <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Born from real-world towing experience. Built for professionals who can't afford failures.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-industrial text-white mb-6">
                OUR <span className="text-yellow-500">STORY</span>
              </h2>
              <div className="space-y-4 text-gray-300">
                <p>
                  K.Todd Driveshaft Cable was born on the streets of Houston, Texas, where heavy-duty towing and recovery is a way of life. After years of watching operators struggle with makeshift solutions—zip ties, bungee cords, and chains that weren't designed for the job—we knew there had to be a better way.
                </p>
                <p>
                  The driveshaft problem is real: when you're towing a Class 7 or 8 truck with a disconnected driveline, that shaft needs to be secured. Drop it on the road and you've got a hazard. Let it drag and you'll destroy seals and transmission components. The repair bill can easily hit $10,000 or more.
                </p>
                <p>
                  We designed the K.Todd Driveshaft Cable specifically for this job. Purpose-built with 5/32" galvanized steel cable and heavy-duty aluminum couplers, it installs in seconds and keeps that shaft exactly where it needs to be.
                </p>
                <p className="text-yellow-500 font-industrial text-lg">
                  Simple. Effective. Field-proven.
                </p>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 p-8">
              <h3 className="text-2xl font-industrial text-yellow-500 mb-6">WHY WE BUILT THIS</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-black font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold">Real Problem</h4>
                    <p className="text-gray-400">Saw too many operators damaged equipment due to unsecured driveshafts</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-black font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold">No Good Solution</h4>
                    <p className="text-gray-400">Existing "solutions" weren't built for heavy-duty applications</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-black font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold">Built It Right</h4>
                    <p className="text-gray-400">Designed by operators, for operators—no compromises</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-ktodd-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-industrial text-white mb-12 text-center">
            WHAT WE <span className="text-yellow-500">STAND FOR</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/30 border border-gray-700 p-8 text-center hover:border-yellow-500 transition-colors">
              <div className="w-16 h-16 bg-yellow-500/20 border border-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-industrial text-white mb-4">SAFETY FIRST</h3>
              <p className="text-gray-400">Every product we make is designed with operator and road safety as the top priority.</p>
            </div>

            <div className="bg-gray-800/30 border border-gray-700 p-8 text-center hover:border-yellow-500 transition-colors">
              <div className="w-16 h-16 bg-yellow-500/20 border border-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-xl font-industrial text-white mb-4">BUILT TO LAST</h3>
              <p className="text-gray-400">Heavy-duty materials and construction that won't let you down in the field.</p>
            </div>

            <div className="bg-gray-800/30 border border-gray-700 p-8 text-center hover:border-yellow-500 transition-colors">
              <div className="w-16 h-16 bg-yellow-500/20 border border-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-industrial text-white mb-4">MADE IN HOUSTON</h3>
              <p className="text-gray-400">Proudly designed and assembled in Houston, Texas, USA.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-yellow-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-industrial text-black mb-4">
            READY TO KEEP YOUR SHAFT SECURE?
          </h2>
          <p className="text-lg text-black/80 mb-8">
            Join the professionals who trust K.Todd Driveshaft Cable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/products" className="bg-black text-yellow-500 hover:bg-gray-900 font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial">
              Shop Now
            </Link>
            <Link to="/contact" className="border-2 border-black text-black hover:bg-black hover:text-yellow-500 font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AboutPage
