import React, { Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Layout from './components/layout/Layout'
import { useCartStore } from './stores/cartStore'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import FAQPage from './pages/FAQPage'
import InstructionsPage from './pages/InstructionsPage'
import NotFoundPage from './pages/NotFoundPage'
import ProductListPage from './pages/ProductListPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import QuotePage from './pages/QuotePage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import BlogListPage from './pages/BlogListPage'
import BlogPostPage from './pages/BlogPostPage'
import SuggestionsPage from './pages/SuggestionsPage'
import TestimonialPage from './pages/TestimonialPage'
import CartRecoverPage from './pages/CartRecoverPage'
import NewsletterConfirmPage from './pages/NewsletterConfirmPage'

// Admin pages (lazy loaded — excluded from public bundle)
const AdminLoginPage = React.lazy(() => import('./pages/admin/AdminLoginPage'))
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminOrdersPage = React.lazy(() => import('./pages/admin/AdminOrdersPage'))
const AdminQuotesPage = React.lazy(() => import('./pages/admin/AdminQuotesPage'))
const AdminEmailPage = React.lazy(() => import('./pages/admin/AdminEmailPage'))
const AdminAnalyticsPage = React.lazy(() => import('./pages/admin/AdminAnalyticsPage'))
const AdminNewsletterPage = React.lazy(() => import('./pages/admin/AdminNewsletterPage'))
const AdminBlogPage = React.lazy(() => import('./pages/admin/AdminBlogPage'))
const AdminSuggestionsPage = React.lazy(() => import('./pages/admin/AdminSuggestionsPage'))
const AdminTestimonialsPage = React.lazy(() => import('./pages/admin/AdminTestimonialsPage'))
const AdminProductsPage = React.lazy(() => import('./pages/admin/AdminProductsPage'))
const AdminSalesPage = React.lazy(() => import('./pages/admin/AdminSalesPage'))

function App() {
  // Hydrate the in-memory pricing map from the `products` table once at app
  // mount so admin price edits propagate without a code change. The cart
  // store falls back to the hardcoded PRODUCT_PRICING constant if the fetch
  // fails, so a flaky DB never blocks rendering.
  useEffect(() => {
    const cart = useCartStore.getState()
    cart.loadProducts()
    cart.loadSales()
  }, [])

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
          <Route path="instructions" element={<InstructionsPage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/:slug" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="checkout/success" element={<OrderSuccessPage />} />
          <Route path="quote" element={<QuotePage />} />
          <Route path="order-tracking" element={<OrderTrackingPage />} />
          <Route path="blog" element={<BlogListPage />} />
          <Route path="blog/:slug" element={<BlogPostPage />} />
          <Route path="suggestions" element={<SuggestionsPage />} />
          <Route path="testimonial" element={<TestimonialPage />} />
          <Route path="cart/recover/:token" element={<CartRecoverPage />} />
          <Route path="newsletter/confirm" element={<NewsletterConfirmPage />} />
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
        <Route path="/admin/blog" element={<Suspense fallback={<div />}><AdminBlogPage /></Suspense>} />
        <Route path="/admin/suggestions" element={<Suspense fallback={<div />}><AdminSuggestionsPage /></Suspense>} />
        <Route path="/admin/testimonials" element={<Suspense fallback={<div />}><AdminTestimonialsPage /></Suspense>} />
        <Route path="/admin/products" element={<Suspense fallback={<div />}><AdminProductsPage /></Suspense>} />
        <Route path="/admin/sales" element={<Suspense fallback={<div />}><AdminSalesPage /></Suspense>} />
      </Routes>
    </BrowserRouter>
    </HelmetProvider>
  )
}

export default App
