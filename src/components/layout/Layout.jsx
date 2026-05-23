import React, { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import NewsletterModal from '../newsletter/NewsletterModal'
import SaleBanner from '../common/SaleBanner'

function Layout() {
  // We measure ONLY the announcement-bar area (sale banner + free-shipping
  // strip), not the header, because page content already adds its own
  // pt-24 md:pt-32 to clear the header. The banner height is what's extra,
  // and it varies (sale banner toggles, text can wrap on narrow viewports).
  const bannerRef = useRef(null)
  const [bannerH, setBannerH] = useState(0)

  useEffect(() => {
    const el = bannerRef.current
    if (!el) return
    const update = () => setBannerH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => { ro.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  return (
    <div className="min-h-screen bg-ktodd-dark flex flex-col">
      {/* Single fixed top stack: sale banner (when active) + free-shipping
          announcement + the actual nav header. The Header itself no longer
          self-fixes — this wrapper does it for the whole group, so the
          banners can't get hidden behind a fixed header. */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div ref={bannerRef}>
          <SaleBanner />
          <div className="bg-yellow-500 text-black text-center py-2 px-4 text-sm font-bold tracking-wide">
            FREE SHIPPING on orders over $400 &nbsp;&middot;&nbsp; $15 flat rate on orders under $400
          </div>
        </div>
        <Header />
      </div>
      {/* Push page content down by exactly the banner height — header
          padding stays the responsibility of each page (pt-24 md:pt-32). */}
      <main className="flex-grow" style={{ paddingTop: bannerH }}>
        <Outlet />
      </main>
      <Footer />
      <NewsletterModal />
    </div>
  )
}

export default Layout
