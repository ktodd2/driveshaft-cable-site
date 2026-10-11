import React, { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import MobileActionBar from './MobileActionBar'
import NewsletterModal from '../newsletter/NewsletterModal'
import SaleBanner from '../common/SaleBanner'
import { isMobileBarRoute } from '../../lib/mobileActionBar'

function Layout() {
  // We measure ONLY the announcement-bar area (sale banner + free-shipping
  // strip), not the header, because page content already adds its own
  // pt-24 md:pt-32 to clear the header. The banner height is what's extra,
  // and it varies (sale banner toggles, text can wrap on narrow viewports).
  const bannerRef = useRef(null)
  const [bannerH, setBannerH] = useState(0)
  const { pathname } = useLocation()
  // Reserve room for the mobile quick-action bar up front on routes where it
  // can appear, so revealing it later never shifts layout or hides the footer.
  const reserveMobileBar = isMobileBarRoute(pathname)

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-yellow-500 focus:px-4 focus:py-3 focus:font-bold focus:text-black"
      >
        Skip to content
      </a>
      {/* Single fixed top stack: sale banner (when active) + free-shipping
          announcement + the actual nav header. The Header itself no longer
          self-fixes — this wrapper does it for the whole group, so the
          banners can't get hidden behind a fixed header. */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div ref={bannerRef}>
          <SaleBanner />
          <div className="bg-[#120d04] text-yellow-400 text-center py-2 px-4 text-xs sm:text-sm font-semibold tracking-wide border-b border-yellow-500/25">
            <span className="text-gray-100">FREE SHIPPING</span> on orders over $400 &nbsp;&middot;&nbsp; $15 flat rate on orders under $400
          </div>
        </div>
        <Header />
      </div>
      {/* Push page content down by exactly the banner height — header
          padding stays the responsibility of each page (pt-24 md:pt-32). */}
      <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none" style={{ paddingTop: bannerH }}>
        <Outlet />
      </main>
      <div className={reserveMobileBar ? 'pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0' : undefined}>
        <Footer />
      </div>
      <MobileActionBar />
      <NewsletterModal />
    </div>
  )
}

export default Layout
