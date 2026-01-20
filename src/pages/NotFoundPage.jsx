import React from 'react'
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="pt-20 min-h-screen flex items-center justify-center bg-ktodd-dark">
      <div className="max-w-xl mx-auto px-4 text-center">
        <div className="text-yellow-500 font-industrial text-9xl mb-4">404</div>
        <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-4">
          PAGE NOT <span className="text-yellow-500">FOUND</span>
        </h1>
        <p className="text-gray-400 mb-8">
          Looks like this driveshaft got disconnected. Let's get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/" className="btn-primary">
            Go Home
          </Link>
          <Link to="/products" className="border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial">
            Shop Products
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
