import React, { useEffect, useState } from 'react'

// Ticking countdown to a sale's ends_at. Updates every second. When the
// timer hits zero it returns null and fires `onExpire`, which the parent can
// use to refresh whatever sale-related state it's displaying.
export default function SaleCountdown({ endsAt, className = '', onExpire }) {
  const compute = () => new Date(endsAt).getTime() - Date.now()
  const [remaining, setRemaining] = useState(compute)

  useEffect(() => {
    // Recompute immediately when endsAt changes (e.g. admin shortens a sale).
    setRemaining(compute())
    const id = setInterval(() => {
      const r = new Date(endsAt).getTime() - Date.now()
      setRemaining(r)
      if (r <= 0) {
        clearInterval(id)
        if (typeof onExpire === 'function') onExpire()
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt])

  if (remaining <= 0) return null

  const totalSec = Math.floor(remaining / 1000)
  const days  = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins  = Math.floor((totalSec % 3600) / 60)
  const secs  = totalSec % 60

  const label = days > 0
    ? `${days}d ${hours}h ${mins}m`
    : hours > 0
    ? `${hours}h ${mins}m ${secs}s`
    : `${mins}m ${secs}s`

  return <span className={className}>{label}</span>
}
