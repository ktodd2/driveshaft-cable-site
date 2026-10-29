import React, { useState } from 'react'

const STANDARD_IMAGE = '/images/cart/driveshaft-cable-standard-yellow.webp'
const XL_IMAGE = '/images/cart/driveshaft-cable-xl-green.webp'

// Resolve at render time so saved and recovered carts receive the new photos
// without rewriting their stored product or purchase data.
function cableImage(item) {
  if (item.sku === 'KTDC-001') return STANDARD_IMAGE
  if (item.sku === 'KTDC-XL-001') return XL_IMAGE
  if (item.slug === 'driveshaft-cable') return STANDARD_IMAGE
  if (item.slug === 'driveshaft-cable-xl') return XL_IMAGE
  return null
}

export default function CartProductImage({ item }) {
  const src = cableImage(item)
  const [failedSrc, setFailedSrc] = useState(null)

  return (
    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt={item.name}
          width="128"
          height="128"
          className="w-full h-full object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <svg viewBox="0 0 100 80" className="w-20 h-16" role="img" aria-label={item.name}>
          <path d="M 15 40 Q 50 20 85 40" stroke="#9CA3AF" strokeWidth="4" fill="none" />
          <rect x="5" y="32" width="18" height="16" rx="2" fill="#D4A017" />
          <rect x="77" y="32" width="18" height="16" rx="2" fill="#D4A017" />
        </svg>
      )}
    </div>
  )
}
