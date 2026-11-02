import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { merchantOrganization } from '../lib/merchantSchema'
import SEOHead from '../components/common/SEOHead'
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, formatPrice } from '../stores/cartStore'

// Shipping, return window, return postage and refund timing confirmed by the owner.
function ShippingReturnsPage() {
  const { hash } = useLocation()
  useEffect(() => {
    const target = hash && document.getElementById(hash.slice(1))
    if (target) target.scrollIntoView({ block: 'start' })
    else window.scrollTo(0, 0)
  }, [hash])

  return (
    <div className="pt-24 md:pt-32 bg-ktodd-dark">
      <SEOHead title="Shipping & Returns" description="Next-business-day shipping, U.S. shipping rates, 90-day returns and refund information for Driveshaft Cable customers." canonical="/shipping-returns" structuredData={merchantOrganization({ shippingFeeCents: SHIPPING_FEE, freeShippingThresholdCents: FREE_SHIPPING_THRESHOLD, includePolicies: true })} />
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-gray-300">
        <h1 className="text-4xl sm:text-5xl font-industrial text-white mb-6">SHIPPING &amp; <span className="text-yellow-500">RETURNS</span></h1>
        <nav aria-label="Shipping and returns topics" className="flex flex-wrap gap-4 mb-10 text-yellow-400 underline underline-offset-4">
          <a href="#shipping">Shipping</a><a href="#tracking">Track an order</a><a href="#returns">Returns &amp; damaged deliveries</a>
        </nav>
        <section id="shipping" className="scroll-mt-44 mb-10">
          <h2 className="text-2xl font-industrial text-white mb-4">U.S. SHIPPING</h2>
          <p className="mb-4">We ship throughout the United States from Houston, Texas.</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>{formatPrice(SHIPPING_FEE)} flat-rate shipping when the merchandise subtotal is below {formatPrice(FREE_SHIPPING_THRESHOLD)}.</li>
            <li>Free shipping when the merchandise subtotal is {formatPrice(FREE_SHIPPING_THRESHOLD)} or more, including exactly {formatPrice(FREE_SHIPPING_THRESHOLD)}.</li>
          </ul>
          <p className="mb-4">The shipping threshold uses the merchandise subtotal after volume pricing and active sales, before returning-customer or discount-code savings. Tax is calculated at checkout.</p>
          <p className="mb-4">Orders ship the next business day. Delivery time after shipment depends on the carrier and destination; use your tracking information for the latest delivery estimate.</p>
          <p>For shipping questions, email <a href="mailto:admin@driveshaftcable.com" className="text-yellow-400 underline">admin@driveshaftcable.com</a>.</p>
          <h3 className="text-xl font-industrial text-white mt-6 mb-3">CANADIAN ORDERS</h3>
          <p>Please contact our Canadian partner, Royal Rigging in Langley, BC, at <a href="tel:+16043292214" className="text-yellow-400 underline">604-329-2214</a> or <a href="mailto:orders@royalrigging.ca" className="text-yellow-400 underline">orders@royalrigging.ca</a> to order in Canada.</p>
        </section>
        <section id="tracking" className="scroll-mt-44 mb-10">
          <h2 className="text-2xl font-industrial text-white mb-4">TRACK YOUR ORDER</h2>
          <p>Once your order ships, you will receive an email with tracking information. You can also <Link to="/order-tracking" className="text-yellow-400 underline">check your order status</Link> using your email address and order number.</p>
        </section>
        <section id="returns" className="scroll-mt-44">
          <h2 className="text-2xl font-industrial text-white mb-4">RETURNS &amp; DAMAGED DELIVERIES</h2>
          <h3 className="text-xl font-industrial text-white mb-3">90-DAY RETURNS</h3>
          <p className="mb-4">You may request a return within 90 days of delivery. The customer pays return shipping.</p>
          <p className="mb-4">To start a return, email <a href="mailto:admin@driveshaftcable.com" className="text-yellow-400 underline">admin@driveshaftcable.com</a> with your order number, the email address used for the order, the items you want to return and their condition. We will provide return instructions.</p>
          <h3 className="text-xl font-industrial text-white mb-3">REFUNDS</h3>
          <p className="mb-6">Approved refunds are issued within five business days. Your bank or card provider may take additional time to post the refund.</p>
          <h3 className="text-xl font-industrial text-white mb-3">IF YOUR PRODUCT ARRIVES DAMAGED</h3>
          <p className="mb-4">Contact us immediately with photos so we can arrange a replacement, as described in our FAQ. Include your order number and the email address used for the order.</p>
          <p className="mb-4">Email <a href="mailto:admin@driveshaftcable.com" className="text-yellow-400 underline">admin@driveshaftcable.com</a> for help with a return, refund or order issue.</p>
          <Link to="/contact" className="btn-secondary">Contact Order Support</Link>
        </section>
      </article>
    </div>
  )
}
export default ShippingReturnsPage
