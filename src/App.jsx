import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import FAQPage from './pages/FAQPage'
import NotFoundPage from './pages/NotFoundPage'
import ProductListPage from './pages/ProductListPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import QuotePage from './pages/QuotePage'
import OrderTrackingPage from './pages/OrderTrackingPage'

// Admin pages (lazy loaded — excluded from public bundle)
const AdminLoginPage = React.lazy(() => import('./pages/admin/AdminLoginPage'))
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminOrdersPage = React.lazy(() => import('./pages/admin/AdminOrdersPage'))
const AdminQuotesPage = React.lazy(() => import('./pages/admin/AdminQuotesPage'))
const AdminEmailPage = React.lazy(() => import('./pages/admin/AdminEmailPage'))
const AdminAnalyticsPage = React.lazy(() => import('./pages/admin/AdminAnalyticsPage'))
const AdminNewsletterPage = React.lazy(() => import('./pages/admin/AdminNewsletterPage'))

function App() {
  return (
    <HelmetProvider>
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="faq" element={<FAQPage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/:slug" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="checkout/success" element={<OrderSuccessPage />} />
          <Route path="quote" element={<QuotePage />} />
          <Route path="order-tracking" element={<OrderTrackingPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Admin routes (lazy loaded) */}
        <Route path="/admin/login" element={<Suspense fallback={<div />}><AdminLoginPage /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<div />}><AdminDashboardPage /></Suspense>} />
        <Route path="/admin/orders" element={<Suspense fallback={<div />}><AdminOrdersPage /></Suspense>} />
        <Route path="/admin/quotes" element={<Suspense fallback={<div />}><AdminQuotesPage /></Suspense>} />
        <Route path="/admin/email" element={<Suspense fallback={<div />}><AdminEmailPage /></Suspense>} />
        <Route path="/admin/analytics" element={<Suspense fallback={<div />}><AdminAnalyticsPage /></Suspense>} />
        <Route path="/admin/newsletter" element={<Suspense fallback={<div />}><AdminNewsletterPage /></Suspense>} />
      </Routes>
    </BrowserRouter>
    </HelmetProvider>
  )
}

export default App
