import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  useCartStore, formatPrice, normalizeDbProduct,
  getPriceForQuantity, getTierPriceForQuantity, getActiveSaleForProduct,
  MIN_ORDER_QUANTITY, ORDER_QUANTITY_STEP,
} from '../../stores/cartStore'
import SaleCountdown from '../common/SaleCountdown'
import { productImageClasses, volumePricingRows, isBoltPack, priceUnit, quantityUnit, packQuantity } from '../../lib/productPresentation'
import { useInventory } from '../../hooks/useInventory'
import { useStorefrontProducts } from '../../hooks/useStorefrontProducts'
import InventoryProgressBar from '../common/InventoryProgressBar'

// Pick the three spec chips we want to highlight on the card. The first
// three values in product.specs would be brittle because Postgres JSONB
// doesn't guarantee insertion order — we kept seeing the "1.2 lb" Weight
// spec sneak into the chip row instead of the strength. Look up by recognized
// label, prefix breaking strength since "3000 lbs" alone doesn't read clearly. Falls
// back to first-three for products that don't have these specific keys.
function topSpecChips(specs) {
  if (!specs || typeof specs !== 'object') return []
  const find = (re) => {
    for (const [key, value] of Object.entries(specs)) {
      i…6279 tokens truncated…  return () => { ro.disconnect(); window.removeEventListener('resize', update) }
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
            <span className="text-gray-100">FREE SHIPPING</span> on orders of $600 or more &nbsp;&middot;&nbsp; $20 flat rate on orders under $600
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
