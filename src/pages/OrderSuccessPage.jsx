import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCheckoutPayment, verifyCheckoutPayment, clearPurchasedCart } from '../lib/checkoutPayment'
import { supabase } from '../lib/supabase'
import { reportPurchase } from '../lib/purchaseAnalytics'
import { formatPrice, useCartStore } from '../stores/cartStore'
import SEOHead from '../components/common/SEOHead'

function OrderSuccessPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order')
  const [paymentStatus, setPaymentStatus] = useState('checking')
  const [order, setOrder] = useState(null)
  const [purchase, setPurchase] = useState(null)
  const [retry, setRetry] = useState(0)
  const clearCart = useCartStore(state => state.clearCart)

  useEffect(() => {
    const payment = getCheckoutPayment(orderId)
    setOrder(null)
    setPurchase(null)
    setPaymentStatus(payment ? 'checking' : 'unverified')
    if (!payment) return
    const controller = new AbortController()
    let timer
    const deadline = Date.now() + 60000
    const check = async () => {
      try {
        const result = await verifyCheckoutPayment(orderId, payment.clientSecret, controller.signal)
        if (controller.signal.aborted) return
        if (result.status === 'paid') {
          setPaymentStatus('paid')
          setOrder(result.order)
          setPurchase(result.purchase)
          clearPurchasedCart(orderId, useCartStore.getState().items, clearCart)
          // Keep the existing confirmation fallback for fulfillment, but gate
          // it on server verification—not the forgeable redirect_status flag.
          // Its outcome is not payment proof and never controls GA reporting.
          try {
            await supabase.from('orders').update({
              payment_status: 'paid', status: 'confirmed',
              stripe_payment_intent_id: payment.clientSecret.split('_secret_')[0],
              updated_at: new Date().toISOString(),
            }).neq('payment_status', 'paid').eq('id', orderId)
          } catch { /* A fulfillment update must not turn a verified payment into an apparent failure. */ }
          return
        }
        setPaymentStatus(result.status === 'failed' ? 'failed' : 'pending')
        if (result.status === 'failed') return
      } catch {
        if (controller.signal.aborted) return
        setPaymentStatus('error')
      }
      // Short return-page reconciliation, not fulfillment. Slow payment methods
      // can settle later via the webhook; the buyer may explicitly check again.
      if (Date.now() < deadline) timer = setTimeout(check, 3000)
    }
    check()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [orderId, retry, clearCart])

  useEffect(() => {
    if (paymentStatus !== 'paid' || !purchase) return
    let stopped = false
    let timer
    const report = async () => {
      const result = await reportPurchase(purchase)
      // A late tag load or consent update can still report while this page is
      // open. Denial never writes the analytics dedup marker.
      if (!stopped && ['denied', 'unavailable', 'error'].includes(result)) timer = setTimeout(report, 1000)
    }
    report()
    return () => { stopped = true; clearTimeout(timer) }
  }, [paymentStatus, purchase])

  if (paymentStatus !== 'paid' && paymentStatus !== 'failed') {
    const checking = paymentStatus === 'checking'
    return (
      <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
        <SEOHead title="Payment Confirmation" noindex />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-industrial text-white mb-4">
            {checking ? 'CHECKING PAYMENT' : paymentStatus === 'pending' ? 'PAYMENT PROCESSING' : 'PAYMENT NOT YET VERIFIED'}
          </h1>
          <p className="text-gray-400 mb-8">
            {paymentStatus === 'pending'
              ? 'Your payment is still processing. Please wait for confirmation before placing another order.'
              : 'We have not confirmed payment on this page yet. This does not mean your payment failed. Please check again or contact us before paying again.'}
          </p>
          {paymentStatus !== 'unverified' && <button className="btn-primary mb-4" onClick={() => setRetry(value => value + 1)}>Check Again</button>}
          <div><a href="mailto:kurtis@k-todd.com" className="text-yellow-500">Contact Support</a></div>
        </div>
      </div>
    )
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
        <SEOHead title="Payment Not Completed" noindex />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-red-500/20 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-4">
              PAYMENT <span className="text-red-500">FAILED</span>
            </h1>
            <p className="text-gray-400">
              Your payment could not be processed. Please try again or contact us for help.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/cart" className="flex-1 btn-primary text-center">
              Return to Cart
            </Link>
            <a href="mailto:kurtis@k-todd.com" className="flex-1 border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial text-center">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
      <SEOHead title="Order Confirmed" noindex />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-industrial text-white mb-4">
            ORDER <span className="text-yellow-500">CONFIRMED!</span>
          </h1>
          <p className="text-gray-400">
            Thank you for your order. Your payment has been received. Please check your email for confirmation.
          </p>
        </div>

        {/* Order Info */}
        <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
            <span className="text-gray-400">Order ID</span>
            <span className="text-yellow-500 font-industrial text-sm font-mono">{orderId}</span>
          </div>
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
            <span className="text-gray-400">Payment Status</span>
            <span className="text-green-400 font-industrial">PAID</span>
          </div>
          <p className="text-gray-400 text-sm">
            We'll process your order and send you shipping information once it's on the way.
          </p>
        </div>

        {/* Order Summary */}
        {order && order.total_cents != null && (
          <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
            <h2 className="text-xl font-industrial text-yellow-500 mb-4">ORDER SUMMARY</h2>
            <div className="space-y-2 text-sm">
              {order.subtotal_cents != null && (
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span className="text-white">{formatPrice(order.subtotal_cents)}</span>
                </div>
              )}
              {order.discount_cents > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Loyalty Discount</span>
                  <span className="font-bold">-{formatPrice(order.discount_cents)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-400">
                <span>Shipping</span>
                {order.shipping_cents === 0
                  ? <span className="text-green-400 font-bold">FREE</span>
                  : <span className="text-white">{formatPrice(order.shipping_cents)}</span>
                }
              </div>
              {order.tax_cents > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Tax</span>
                  <span className="text-white">{formatPrice(order.tax_cents)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="text-white font-bold">Total</span>
                <span className="text-yellow-500 font-bold text-lg">{formatPrice(order.total_cents)}</span>
              </div>
            </div>
          </div>
        )}

        {/* What's Next */}
        <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-industrial text-yellow-500 mb-4">WHAT'S NEXT?</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold">Payment Received</h3>
                <p className="text-gray-400 text-sm">Your payment has been processed successfully.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-black font-bold text-sm">2</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Processing</h3>
                <p className="text-gray-400 text-sm">We'll prepare your order for shipment.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 font-bold text-sm">3</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Shipping</h3>
                <p className="text-gray-400 text-sm">You'll receive tracking info when your order ships.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 font-bold text-sm">4</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Delivery</h3>
                <p className="text-gray-400 text-sm">Your Driveshaft Cable arrives!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/products" className="flex-1 btn-primary text-center">
            Continue Shopping
          </Link>
          <a href="mailto:kurtis@k-todd.com" className="flex-1 border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-bold py-3 px-8 uppercase tracking-wider transition-all duration-300 font-industrial text-center">
            Contact Us
          </a>
        </div>

        {/* Support */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 mb-2">Questions about your order?</p>
          <a href="mailto:kurtis@k-todd.com" className="text-yellow-500 hover:text-yellow-400 transition-colors">
            kurtis@k-todd.com
          </a>
        </div>
      </div>
    </div>
  )
}

export default OrderSuccessPage
