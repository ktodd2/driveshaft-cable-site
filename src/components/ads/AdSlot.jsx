import React, { useEffect, useRef } from 'react'

function AdSlot({ slot, format = 'auto', responsive = true, className = '' }) {
  const adRef = useRef(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (adRef.current && !pushed.current) {
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        pushed.current = true
      } catch (e) {
        // AdSense not loaded or ad blocker active
      }
    }
  }, [])

  return (
    <div className={`ad-slot ${className}`}>
      <ins
        className="adsbygoogle"
        ref={adRef}
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  )
}

export default AdSlot
