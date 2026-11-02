import React, { useEffect, useRef } from 'react'
import { loadAdSense } from '../../lib/loadAdSense'

function AdSlot({ slot, format = 'auto', responsive = true, className = '' }) {
  const adRef = useRef(null)
  const pushed = useRef(false)

  useEffect(() => {
    let active = true
    const element = adRef.current
    const show = () => {
      observer?.disconnect()
      loadAdSense().then(() => {
        if (!active || !element?.isConnected || pushed.current) return
        try {
          ;(window.adsbygoogle = window.adsbygoogle || []).push({})
          pushed.current = true
        } catch {
          // Ad blockers and unavailable ads must not interrupt the article.
        }
      }).catch(() => {})
    }
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) show()
        }, { rootMargin: '200px' })
      : null
    if (element && observer) observer.observe(element)
    else if (element) show()
    return () => { active = false; observer?.disconnect() }
  }, [])

  return (
    <div className={`ad-slot ${className}`}>
      <ins
        className="adsbygoogle"
        ref={adRef}
        style={{ display: 'block' }}
        data-ad-client="ca-pub-3653983384826324"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  )
}

export default AdSlot
