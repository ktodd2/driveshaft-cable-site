import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import NewsletterModal from '../newsletter/NewsletterModal'
import SaleBanner from '../common/SaleBanner'

function Layout() {
  return (
    <div className="min-h-screen bg-ktodd-dark flex flex-col">
      {/* Sitewide sale banner — only renders when a sitewide sale is live. */}
      <SaleBanner />
      {/* Announcement Bar */}
      <div className="bg-yellow-500 text-black text-center py-2 px-4 text-sm font-bold tracking-wide">
        FREE SHIPPING on orders over $400 &nbsp;&middot;&nbsp; $15 flat rate on orders under $400
      </div>
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <NewsletterModal />
    </div>
  )
}

export default Layout
