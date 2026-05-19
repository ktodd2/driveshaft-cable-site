import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useCartStore, selectTotalItems, selectSubtotal, selectPricePerUnit, selectShipping, selectOrderTotal, formatPrice, SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, REPEAT_CUSTOMER_DISCOUNT } from '../stores/cartStore'
import { supabase } from '../lib/supabase'
import SEOHead from '../components/common/SEOHead'

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Payment Form Component
function PaymentForm({ clientSecret, orderId, totalCents, onSuccess, items }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const { clearCart } = useCartStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?order=${orderId}`,
      },
      redirect: 'if_required',
    })

    if (submitError) {
      setError(submitError.message)
      setIsProcessing(false)
      return
    }

    // Payment succeeded without redirect — update order in Supabase
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          stripe_payment_intent_id: paymentIntent.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      clearCart()
      navigate(`/checkout/success?order=${orderId}&redirect_status=succeeded`)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 mt-4">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          `Pay ${formatPrice(totalCents)}`
        )}
      </button>
    </form>
  )
}

function CheckoutPage() {
  const navigate = useNavigate()
  const { items, clearCart } = useCartStore()
  const totalItems = useCartStore(selectTotalItems)
  const subtotal = useCartStore(selectSubtotal)

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US'
  })
  const [clientSecret, setClientSecret] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [step, setStep] = useState(1) // 1 = shipping info, 2 = payment
  const [isRepeatCustomer, setIsRepeatCustomer] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  // Stripe Tax state. taxCalculationId is the id of a stripe.tax.calculations
  // record that the webhook will finalize into a transaction after payment.
  // Without it, the sale won't appear in Stripe Tax's filing reports.
  const [taxCents, setTaxCents] = useState(0)
  const [taxCalculationId, setTaxCalculationId] = useState(null)
  const [isCalculatingTax, setIsCalculatingTax] = useState(false)
  const [taxError, setTaxError] = useState(null)

  const shippingCents = useCartStore(selectShipping)
  const baseTotal = useCartStore(selectOrderTotal)
  const pricePerUnit = useCartStore(selectPricePerUnit)

  // Calculate loyalty discount
  const discountCents = isRepeatCustomer ? Math.round(subtotal * REPEAT_CUSTOMER_DISCOUNT) : 0
  const totalCents = baseTotal - discountCents + taxCents

  // Recalculate tax whenever the address (city + state + zip), the cart, or
  // the loyalty discount changes. Debounced 500ms so each keystroke doesn't
  // burn a Stripe Tax API call. Tax calculations are billed per-request once
  // Stripe Tax is on a paid plan, so this debounce matters.
  useEffect(() => {
    const hasMinimumAddress =
      formData.country &&
      formData.zip && formData.zip.trim().length >= 5 &&
      formData.state && formData.state.trim().length > 0
    if (!hasMinimumAddress || items.length === 0) {
      setTaxCents(0)
      setTaxCalculationId(null)
      setTaxError(null)
      return
    }

    const handle = setTimeout(async () => {
      setIsCalculatingTax(true)
      setTaxError(null)
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-tax`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              items: items.map(item => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
              })),
              shippingAddress: {
                line1: formData.address1,
                line2: formData.address2,
                city: formData.city,
                state: formData.state,
                postal_code: formData.zip,
                country: formData.country,
              },
              discountCents,
            }),
          }
        )
        const data = await response.json()
        if (data.error) throw new Error(data.error)
        setTaxCents(data.taxCents || 0)
        setTaxCalculationId(data.calculationId)
      } catch (err) {
        // Fail closed: don't show a tax line, but surface the error so the
        // customer knows their address may need attention.
        setTaxCents(0)
        setTaxCalculationId(null)
        setTaxError(err.message || 'Could not calculate tax for this address.')
      } finally {
        setIsCalculatingTax(false)
      }
    }, 500)

    return () => clearTimeout(handle)
  }, [
    formData.address1, formData.city, formData.state, formData.zip, formData.country,
    items, discountCents
  ])

  // Check if email belongs to a returning customer
  const checkRepeatCustomer = async (email) => {
    if (!email || !email.includes('@')) return
    setCheckingEmail(true)
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('email', email.toLowerCase().trim())
        .eq('payment_status', 'paid')
      if (!error && count > 0) {
        setIsRepeatCustomer(true)
      } else {
        setIsRepeatCustomer(false)
      }
    } catch {
      setIsRepeatCustomer(false)
    }
    setCheckingEmail(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleShippingSubmit = async (e) => {
    e.preventDefault()
    setIsCreatingOrder(true)
    setOrderError(null)

    try {
      // 1. Create order in Supabase
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          email: formData.email,
          name: formData.name,
          company: formData.company,
          phone: formData.phone,
          shipping_address: {
            address1: formData.address1,
            address2: formData.address2,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            country: formData.country
          },
          items: items.map(item => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          subtotal_cents: subtotal,
          discount_cents: discountCents,
          discount_reason: isRepeatCustomer ? 'Returning customer 10% loyalty discount' : null,
          shipping_cents: shippingCents,
          tax_cents: taxCents,
          stripe_tax_calculation_id: taxCalculationId,
          total_cents: totalCents,
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'stripe'
        }])
        .select()
        .single()

      if (orderError) throw orderError

      setOrderId(order.id)

      // 2. Create payment intent via Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            amount: totalCents,
            orderId: order.id,
            customerEmail: formData.email,
            items: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity
            })),
            taxCalculationId,
          })
        }
      )

      const { clientSecret: secret, error: intentError } = await response.json()

      if (intentError) throw new Error(intentError)

      setClientSecret(secret)
      setStep(2)
    } catch (err) {
      console.error('Error creating order:', err)
      setOrderError(err.message || 'Failed to create order. Please try again.')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-3xl font-industrial text-white mb-4">YOUR CART IS EMPTY</h1>
          <p className="text-gray-400 mb-8">Add some items before checking out.</p>
          <Link to="/products" className="btn-primary">
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title="Checkout"
        noindex={true}
        canonical="/checkout"
      />
      {/* Header */}
      <section className="py-8 bg-ktodd-dark border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/cart" className="text-gray-400 hover:text-yellow-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-industrial text-white">CHECKOUT</h1>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-4 mt-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-yellow-500' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-yellow-500 bg-yellow-500 text-black' : 'border-gray-500'}`}>
                1
              </div>
              <span className="text-sm">Shipping</span>
            </div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-yellow-500' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-yellow-500 bg-yellow-500 text-black' : 'border-gray-500'}`}>
                2
              </div>
              <span className="text-sm">Payment</span>
            </div>
          </div>
        </div>
      </section>

      {/* Checkout Content */}
      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {step === 1 ? (
                <form onSubmit={handleShippingSubmit}>
                  {/* Contact */}
                  <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-industrial text-yellow-500 mb-6">CONTACT INFORMATION</h2>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="email" className="block text-gray-400 text-sm mb-1">Email *</label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          onBlur={(e) => checkRepeatCustomer(e.target.value)}
                          required
                          placeholder="your@email.com"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                        {checkingEmail && (
                          <p className="text-gray-500 text-xs mt-1">Checking for loyalty discount...</p>
                        )}
                      </div>
                      {isRepeatCustomer && (
                        <div className="bg-green-500/10 border border-green-500 p-4 flex items-center gap-3">
                          <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-green-400 font-bold text-sm">Welcome back! Returning Customer: 10% Off!</p>
                            <p className="text-green-400/70 text-xs">Your loyalty discount of {formatPrice(discountCents)} will be applied automatically.</p>
                          </div>
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="name" className="block text-gray-400 text-sm mb-1">Full Name *</label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="John Smith"
                            className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="phone" className="block text-gray-400 text-sm mb-1">Phone *</label>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            placeholder="(555) 555-5555"
                            className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="company" className="block text-gray-400 text-sm mb-1">Company (optional)</label>
                        <input
                          type="text"
                          id="company"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          placeholder="Company name"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-industrial text-yellow-500 mb-6">SHIPPING ADDRESS</h2>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="address1" className="block text-gray-400 text-sm mb-1">Address *</label>
                        <input
                          type="text"
                          id="address1"
                          name="address1"
                          value={formData.address1}
                          onChange={handleChange}
                          required
                          placeholder="123 Main Street"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="address2" className="block text-gray-400 text-sm mb-1">Apartment, suite, etc.</label>
                        <input
                          type="text"
                          id="address2"
                          name="address2"
                          value={formData.address2}
                          onChange={handleChange}
                          placeholder="Apt 4B"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="city" className="block text-gray-400 text-sm mb-1">City *</label>
                          <input
                            type="text"
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            required
                            placeholder="Houston"
                            className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="state" className="block text-gray-400 text-sm mb-1">State *</label>
                          <input
                            type="text"
                            id="state"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            required
                            placeholder="TX"
                            className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="zip" className="block text-gray-400 text-sm mb-1">ZIP Code *</label>
                          <input
                            type="text"
                            id="zip"
                            name="zip"
                            value={formData.zip}
                            onChange={handleChange}
                            required
                            placeholder="77001"
                            className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {orderError && (
                    <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 mb-8">
                      {orderError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCreatingOrder || isCalculatingTax}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingOrder ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : isCalculatingTax ? (
                      'Calculating tax…'
                    ) : (
                      'Continue to Payment'
                    )}
                  </button>
                </form>
              ) : (
                <div className="bg-gray-800/50 border border-gray-700 p-6">
                  <h2 className="text-xl font-industrial text-yellow-500 mb-6">PAYMENT</h2>

                  {/* Shipping Summary */}
                  <div className="mb-6 pb-6 border-b border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-gray-400 text-sm">Shipping to:</p>
                        <p className="text-white">{formData.name}</p>
                        <p className="text-gray-300 text-sm">
                          {formData.address1}{formData.address2 ? `, ${formData.address2}` : ''}<br />
                          {formData.city}, {formData.state} {formData.zip}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(1)}
                        className="text-yellow-500 hover:text-yellow-400 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {clientSecret && (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'night',
                          variables: {
                            colorPrimary: '#FFD700',
                            colorBackground: '#1F2937',
                            colorText: '#FFFFFF',
                            colorDanger: '#EF4444',
                            fontFamily: 'Roboto, sans-serif',
                            borderRadius: '0px'
                          }
                        }
                      }}
                    >
                      <PaymentForm
                        clientSecret={clientSecret}
                        orderId={orderId}
                        totalCents={totalCents}
                        items={items}
                      />
                    </Elements>
                  )}
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div>
              <div className="bg-gray-800/50 border border-gray-700 p-6 sticky top-24">
                <h2 className="text-xl font-industrial text-yellow-500 mb-6">ORDER SUMMARY</h2>

                {/* Items */}
                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div key={item.productId} className="flex gap-4">
                      <div className="w-16 h-16 bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 50 40" className="w-10 h-8">
                          <path d="M 8 20 Q 25 10 42 20" stroke="#9CA3AF" strokeWidth="2" fill="none" />
                          <rect x="3" y="16" width="9" height="8" rx="1" fill="#D4A017" />
                          <rect x="38" y="16" width="9" height="8" rx="1" fill="#D4A017" />
                        </svg>
                      </div>
                      <div className="flex-grow">
                        <div className="text-white text-sm">{item.name}</div>
                        <div className="text-gray-400 text-xs">Qty: {item.quantity}</div>
                      </div>
                      <div className="text-white text-sm">
                        {formatPrice(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-3 border-t border-gray-700 pt-4">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span className="text-white">{formatPrice(subtotal)}</span>
                  </div>
                  {discountCents > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Loyalty Discount (10%)</span>
                      <span className="font-bold">-{formatPrice(discountCents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400">
                    <span>Shipping</span>
                    {shippingCents === 0
                      ? <span className="text-green-400 font-bold">FREE</span>
                      : <span className="text-white">{formatPrice(shippingCents)}</span>
                    }
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Tax</span>
                    {isCalculatingTax ? (
                      <span className="text-gray-500 text-sm italic">Calculating…</span>
                    ) : taxCalculationId ? (
                      <span className="text-white">{formatPrice(taxCents)}</span>
                    ) : (
                      <span className="text-gray-500 text-sm italic">Enter address</span>
                    )}
                  </div>
                  {taxError && (
                    <div className="text-red-400 text-xs">{taxError}</div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-gray-700">
                    <span className="text-white font-bold">Total</span>
                    <span className="text-yellow-500 font-bold text-xl">{formatPrice(totalCents)}</span>
                  </div>
                </div>

                <p className="text-gray-500 text-xs text-center mt-6">
                  Secure checkout powered by Stripe
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default CheckoutPage
