import React from 'react'
import { useCartStore, getActiveSaleForProduct, getLiveSales } from '../../stores/cartStore'
import SaleCountdown from './SaleCountdown'

// Top-of-page red strip shown when a sitewide sale is currently live.
// Reads sales from cartStore (module-scope liveSales array) and subscribes
// to `salesLoadedAt` so it re-renders whenever sales reload. The countdown
// also fires re-renders via onExpire when the sale ends.
//
// Product-specific sales do NOT show the sitewide banner — they're
// surfaced on the product card / detail page instead.
export default function SaleBanner() {
  // Subscribe so we re-render when sales reload or expire (via setSalesTick).
  const salesLoadedAt = useCartStore(s => s.salesLoadedAt)
  const [tick, setTick] = React.useState(0)

  const sales = getLiveSales()
  // Use product '__sitewide__' to find any sitewide sale specifically. We
  // pass an empty productId so only sitewide candidates are eligible.
  const sitewide = sales.find(s => {
    if (s.scope !== 'sitewide' || !s.is_active) return false
    const now = Date.now()
    return now >= new Date(s.starts_at).getTime() && now < new Date(s.ends_at).getTime()
  })

  if (!sitewide) return null

  return (
    <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-bold tracking-wide flex items-center justify-center gap-3 flex-wrap">
      <span className="uppercase">{sitewide.name}</span>
      <span aria-hidden>·</span>
      <span>{sitewide.discount_percent}% OFF SITEWIDE</span>
      <span aria-hidden>·</span>
      <span>
        Ends in{' '}
        <SaleCountdown
          endsAt={sitewide.ends_at}
          className="font-mono"
          onExpire={() => setTick(t => t + 1)}
        />
      </span>
    </div>
  )
}
