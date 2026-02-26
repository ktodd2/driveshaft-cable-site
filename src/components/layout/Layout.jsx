import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

function Layout() {
  return (
    <div className="min-h-screen bg-ktodd-dark flex flex-col">
      {/* Announcement Bar */}
      <div className="bg-yellow-500 text-black text-center py-2 px-4 text-sm font-bold tracking-wide">
        FREE SHIPPING on orders over $100 &nbsp;&middot;&nbsp; $10 flat rate on orders under $100
      </div>
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default Layout
