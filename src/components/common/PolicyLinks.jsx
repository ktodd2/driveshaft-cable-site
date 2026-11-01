import React from 'react'
import { Link } from 'react-router-dom'

export default function PolicyLinks({ className = '' }) {
  return (
    <nav aria-label="Order policies" className={`flex flex-wrap gap-x-5 gap-y-2 text-sm ${className}`}>
      <Link to="/shipping-returns#shipping" className="text-yellow-400 underline underline-offset-4 hover:text-yellow-300">Shipping information</Link>
      <Link to="/shipping-returns#returns" className="text-yellow-400 underline underline-offset-4 hover:text-yellow-300">Returns &amp; damaged deliveries</Link>
    </nav>
  )
}
