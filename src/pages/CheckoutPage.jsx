import { useCommerceView } from '../hooks/useCommerceView'
import PolicyLinks from '../components/common/PolicyLinks'
import { captureAnalyticsContext } from '../lib/purchaseAnalytics'
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useCartStore, getPriceForQuantity, selectTotalItems, selectSubtotal, selectPricePerUnit, selectShipping, selectOrderTotal, formatPrice, SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, REPEAT_CUSTOMER_DISCOUNT } from '../stores/cartStore'
import { getShippingAddressProblem, SHIPPING_ADDRESS_MESSAGES } from '../lib/shippingAddress'
import { supabase } from '../lib/supabase'
import { rememberCheckoutPayment, clearPurchasedCart, getOrCreateCheckoutDraft, getCurrentCheckoutDraft, markCheckoutDraftSubmitted, forgetCancelledCheckoutDraft } from '../lib/checkoutPayment'
import SEOHead from '../components/common/SEOHead'
import BuyerEmailVerification from '../components/checkout/BuyerEmailVerification'
import CheckoutOrderItems from '../components/checkout/CheckoutOrderItems'
import { quotedCheckoutItems } from '../lib/checkoutSummary'
import {getBuyerVerification,forgetBuyerVerification} from '../lib/buyerVerification'

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

    // The server webhook and capability-protected confirmation own fulfillment.
    if (paymentIntent && ['succeeded', 'processing'].includes(paymentIntent.status)) {
      if (paymentIntent.status === 'succeeded') {
        clearPurchasedCart(orderId, useCartStore.getState().items, clearCart)
      }
      navigate(`/checkout/success?order=${orderId}`)
    } else {
      setError('Your payment needs further action. Please check your payment details.')
      setIsProcessing(false)
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
  const cartSubtotal = useCartStore(selectSubtotal)
  const productsLoadedAt = useCartStore(s => s.productsLoadedAt)
  const salesLoadedAt = useCartStore(s => s.salesLoadedAt)
  useCommerceView('begin_checkout', 'checkout', items.map(item => ({ productId: item.productId,
    quantity: item.quantity, unitCents: getPriceForQuantity(item.productId, item.quantity) })),
    items.length > 0 && productsLoadedAt > 0 && salesLoadedAt > 0)

  // Carried in from an abandoned-cart recovery link so we can auto-apply the
  // 5% code without the customer typing it.
  const recoveryDiscountCode = useCartStore(s => s.recoveryDiscountCode)
  const recoveryEmail = useCartStore(s => s.recoveryEmail)

  const [referralCode, setReferralCode] = useState('')
  const [formData, setFormData] = useState({
    email: getBuyerVerification()?.email || '',
    name: '',
    company: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    hearAboutUs: '',      // "How did you hear about us?" dropdown selection
    hearAboutUsOther: ''  // free text, only used when hearAboutUs === 'Other'
  })
  const [clientSecret, setClientSecret] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [step, setStep] = useState(1) // 1 = shipping info, 2 = payment
  const [pendingDraft,setPendingDraft]=useState(()=>!!getCurrentCheckoutDraft()?.submitted||!!getCurrentCheckoutDraft()?.orderId)
  const [cancelReview,setCancelReview]=useState(false)
  const [quoteData,setQuoteData]=useState(null)
  const [paymentSnapshot,setPaymentSnapshot]=useState(null)
  const [buyerProof,setBuyerProof]=useState(()=>getBuyerVerification(formData.email))
  const [serverRequiresVerification,setServerRequiresVerification]=useState(false)
  const [isRepeatCustomer, setIsRepeatCustomer] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  // The quote exposes amounts only; the server retains and finalizes the tax calculation.
  const [taxCents, setTaxCents] = useState(0)
  const [taxQuoted, setTaxQuoted] = useState(false)
  const [isCalculatingTax, setIsCalculatingTax] = useState(false)
  const [taxError, setTaxError] = useState(null)

  // Discount code state. Codes (WELCOME5, COMEBACK5) are 5% off, single-use
  // per email. The actual redemption row is written by stripe-webhook on
  // payment_intent.succeeded so an abandoned checkout doesn't burn the code.
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [appliedCode, setAppliedCode] = useState(null) // string | null
  const [appliedCodePercentOff, setAppliedCodePercentOff] = useState(0)
  const [validatingCode, setValidatingCode] = useState(false)
  const [codeError, setCodeError] = useState(null)

  const cartShippingCents = useCartStore(selectShipping)
  const baseTotal = useCartStore(selectOrderTotal)
  const pricePerUnit = useCartStore(selectPricePerUnit)

  // Eligible loyalty and coupon savings both apply to the sale-adjusted subtotal.
  const quoteKey=JSON.stringify([formData,items.map(item=>[item.productId,item.quantity]),appliedCode,referralCode.trim().toUpperCase()])
  const activeQuote=step===2&&paymentSnapshot?paymentSnapshot.pricing:quoteData
  const quoteReady=step===2&&!!paymentSnapshot||quoteData?.key===quoteKey
  const summaryItems=step===2&&paymentSnapshot?paymentSnapshot.items:quoteReady?quoteData.items:items
  const subtotal=quoteReady?activeQuote.subtotalCents:cartSubtotal
  const shippingCents=quoteReady?activeQuote.shippingCents:cartShippingCents
  const loyaltyDiscountCents = isRepeatCustomer ? Math.round(subtotal * REPEAT_CUSTOMER_DISCOUNT) : 0
  const codeDiscountCents = appliedCodePercentOff > 0 ? Math.round(subtotal * appliedCodePercentOff / 100) : 0
  const discountCents = quoteReady?activeQuote.discountCents:Math.min(subtotal, loyaltyDiscountCents + codeDiscountCents)
  const discountSource = quoteReady?activeQuote.discountSource:
    discountCents === 0 ? null :
    loyaltyDiscountCents && codeDiscountCents ? 'combined' : loyaltyDiscountCents ? 'loyalty' : 'code'
  const totalCents = quoteReady?activeQuote.totalCents:baseTotal - discountCents + taxCents
  const verificationRequired=!!activeQuote?.verificationRequired||serverRequiresVerification
  const buyerProofValid=buyerProof?.email===formData.email.trim().toLowerCase()&&buyerProof?.expiresAt>Date.now()
  useEffect(()=>{setServerRequiresVerification(false);setBuyerProof(getBuyerVerification(formData.email))},[formData.email])

  // Recalculate tax whenever the address (city + state + zip), the cart, or
  // the loyalty discount changes. Debounced 500ms so each keystroke doesn't
  // burn a Stripe Tax API call. Tax calculations are billed per-request once
  // Stripe Tax is on a paid plan, so this debounce matters.
  useEffect(() => {
    if(step===2){setIsCalculatingTax(false);setCheckingEmail(false);return}
    if (items.length === 0) return
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      setIsCalculatingTax(true)
      setCheckingEmail(true)
      setTaxError(null)
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-checkout`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              items: items.map(item => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
              })),
              customer: formData,
              discountCode: appliedCode,
              referralCode: referralCode.trim() || null,
            }),
          }
        )
        const data = await response.json()
        if (data.error) throw new Error(data.error)
        if (controller.signal.aborted) return
        if(!['subtotalCents','discountCents','shippingCents','taxCents','totalCents'].every(key=>Number.isSafeInteger(data[key])&&data[key]>=0)||data.totalCents!==data.subtotalCents-data.discountCents+data.shippingCents+data.taxCents)throw Error('Could not verify the quoted total.')
        const quotedItems = quotedCheckoutItems(items, data)
        setQuoteData({...data,items:quotedItems,key:quoteKey})
        setIsRepeatCustomer(data.repeat === true)
        setTaxCents(data.taxCents || 0)
        setTaxQuoted(data.taxQuoted === true)
      } catch (err) {
        if (controller.signal.aborted) return
        // Fail closed: don't show a tax line, but surface the error so the
        // customer knows their address may need attention.
        setTaxCents(0)
        setTaxQuoted(false)
        setTaxError(err.message || 'Could not calculate tax for this address.')
      } finally {
        if (!controller.signal.aborted) { setIsCalculatingTax(false); setCheckingEmail(false) }
      }
    }, 500)

    return () => { clearTimeout(handle); controller.abort() }
  }, [quoteKey,step])

  // Write an abandoned-cart row when the customer has entered a valid email
  // and has items in the cart but hasn't yet reached payment. Debounced 5s
  // so we don't write on every keystroke. Only writes once per email change.
  // The hourly cron picks these up and sends a recovery email.
  const abandonmentEmailRef = React.useRef(null)
  useEffect(() => {
    const email = formData.email.toLowerCase().trim()
    if (!email || !email.includes('@') || items.length === 0 || step !== 1) return
    if (email === abandonmentEmailRef.current) return

    const handle = setTimeout(async () => {
      const recoveryToken = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`
      const { error } = await supabase.from('cart_abandonments').insert({
        email,
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal_cents: subtotal,
        recovery_token: recoveryToken,
      })
      if (!error) {
        abandonmentEmailRef.current = email
      }
    }, 5000)

    return () => clearTimeout(handle)
  }, [formData.email, items, subtotal, step])

  // Validate + apply a discount code. Accepts explicit code/email so the
  // abandoned-cart recovery flow can drive it programmatically; falls back to
  // the manual input state when called from the Apply button.
  const applyCode = async (rawCode, rawEmail) => {
    const code = (rawCode ?? codeInput).trim().toUpperCase()
    const email = (rawEmail ?? formData.email).toLowerCase().trim()
    setCodeError(null)
    if (!code) {
      setCodeError('Enter a code first.')
      return
    }
    if (!email || !email.includes('@')) {
      setCodeError('Enter your email above first — codes are tied to your address.')
      return
    }
    setValidatingCode(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-discount-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ code, email }),
        }
      )
      const data = await response.json()
      if (!data.valid) {
        setCodeError(data.reason || 'Invalid code.')
        setAppliedCode(null)
        setAppliedCodePercentOff(0)
      } else {
        setAppliedCode(data.code)
        setAppliedCodePercentOff(data.percentOff)
        setCodeError(null)
      }
    } catch (err) {
      setCodeError(err.message || 'Could not verify code.')
    } finally {
      setValidatingCode(false)
    }
  }

  const handleApplyCode = () => applyCode()

  // Check if email belongs to a returning customer
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Prefill the email from an abandoned-cart recovery link so the customer
  // doesn't retype it — and so the recovery discount can validate immediately.
  // Also kicks off the repeat-customer check.
  useEffect(() => {
    if (recoveryEmail && !formData.email) {
      setFormData(prev => ({ ...prev, email: recoveryEmail }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryEmail])

  // Auto-apply the recovery discount once we have a code and a usable email,
  // and nothing's applied yet. validate-discount-code still enforces validity
  // and single-use, so a burnt/invalid code just no-ops here.
  useEffect(() => {
    const email = formData.email.toLowerCase().trim()
    if (recoveryDiscountCode && !appliedCode && !validatingCode && email.includes('@')) {
      applyCode(recoveryDiscountCode, email)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryDiscountCode, formData.email, appliedCode, validatingCode])

  const handleShippingSubmit = async (e) => {
    e.preventDefault()
    setOrderError(null)

    const addressProblem = getShippingAddressProblem(formData)
    if (addressProblem) {
      setOrderError(SHIPPING_ADDRESS_MESSAGES[addressProblem])
      return
    }

    setIsCreatingOrder(true)

    try {
      const signature = JSON.stringify([formData,items.map(i=>[i.productId,i.quantity]),totalCents,appliedCode,referralCode])
      const draft = await getOrCreateCheckoutDraft(signature)
      markCheckoutDraftSubmitted(draft)
      setPendingDraft(true)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-secure-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
          },
          // The server creates the order, recomputes its total and refuses
          // if it doesn't match `amount` (what the customer is shown).
          body: JSON.stringify({
            amount: totalCents,
            analytics: await captureAnalyticsContext(),
            checkoutId: draft.id,
            checkoutToken: draft.token,
            customer: formData,
            items: items.map(item=>({productId:item.productId,quantity:item.quantity})),
            howHeard: formData.hearAboutUs === 'Other' ? formData.hearAboutUsOther.trim() || 'Other' : formData.hearAboutUs,
            referralCode: referralCode.trim() || null,
            discountCode: appliedCode,
            buyerVerificationToken: buyerProofValid?buyerProof.token:null,
          })
        }
      )

      const { clientSecret: secret, orderId: createdOrderId, status, error: intentError, checkout, verificationRequired:verifyRequired } = await response.json()

      if(verifyRequired){setServerRequiresVerification(true);forgetBuyerVerification(formData.email);setBuyerProof(null)}

      if (intentError) throw new Error(intentError)

      setOrderId(createdOrderId)
      rememberCheckoutPayment(createdOrderId, secret, window, items)
      setClientSecret(secret)
      if(checkout)setPaymentSnapshot(checkout)
      if (status === 'succeeded' || status === 'processing') navigate(`/checkout/success?order=${createdOrderId}`)
      else setStep(2)
    } catch (err) {
      console.error('Error creating order:', err)
      setOrderError(err.message || 'Failed to create order. Please try again.')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  async function cancelCheckout(){
    const draft=getCurrentCheckoutDraft()
    if(!draft){setCancelReview(false);setPendingDraft(false);return}
    setIsCreatingOrder(true);setOrderError(null)
    try{
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-secure-checkout`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({checkoutId:draft.id,checkoutToken:draft.token})})
      const result=await response.json()
      if(result.status==='paid'&&result.orderId){if(result.clientSecret)rememberCheckoutPayment(result.orderId,result.clientSecret,window,items);navigate(`/checkout/success?order=${result.orderId}`);return}
      if(!response.ok||result.status!=='cancelled')throw Error(result.error||'Cancellation is not verified. Resume this checkout or contact us before paying again.')
      forgetCancelledCheckoutDraft(draft.id);setClientSecret(null);setOrderId(null);setPaymentSnapshot(null);setPendingDraft(false);setCancelReview(false);setStep(1)
    }catch(error){setOrderError(error.message||'Cancellation could not be verified. Do not pay again until it is checked.')}
    finally{setIsCreatingOrder(false)}
  }

  async function resumeCheckout(){
    const draft=getCurrentCheckoutDraft();if(!draft)return
    setIsCreatingOrder(true);setOrderError(null)
    try{
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-secure-checkout`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({checkoutId:draft.id,checkoutToken:draft.token})})
      const result=await response.json()
      if(!response.ok||!result.checkout||!result.clientSecret)throw Error(result.error||'The original checkout cannot be resumed. Review its cancellation or contact us before paying again.')
      setFormData({...formData,...result.checkout.customer});setReferralCode(result.checkout.referralCode||'');setAppliedCode(result.checkout.discountCode||null)
      setPaymentSnapshot(result.checkout);setTaxCents(result.checkout.pricing.taxCents);setTaxQuoted(result.checkout.pricing.taxQuoted)
      setClientSecret(result.clientSecret);setOrderId(result.orderId);rememberCheckoutPayment(result.orderId,result.clientSecret,window,result.checkout.items)
      if(['succeeded','processing'].includes(result.status))navigate(`/checkout/success?order=${result.orderId}`)
      else setStep(2)
    }catch(error){setOrderError(error.message||'Checkout recovery needs owner verification before paying again.')}
    finally{setIsCreatingOrder(false)}
  }

  if (items.length === 0&&!pendingDraft) {
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
          {pendingDraft&&<div className="border border-gray-600 p-4 mb-6"><p>An unfinished checkout may still be payable. Resume it, or cancel the unpaid checkout before starting over. First orders use one payable checkout per email. If you lost the original browser session, contact us for owner-assisted verification.</p><button type="button" disabled={isCreatingOrder} className="underline text-yellow-400 mt-2 mr-4" onClick={resumeCheckout}>Resume / check payment</button><button type="button" disabled={isCreatingOrder} className="underline text-yellow-400 mt-2" onClick={()=>setCancelReview(true)}>Review unpaid checkout cancellation</button>{orderError&&!cancelReview&&<p role="alert" className="text-red-300 mt-2">{orderError}</p>}</div>}
          {cancelReview&&<section aria-label="Review checkout cancellation" className="border border-yellow-500 p-4 mb-6 space-y-3"><h2 className="text-white font-bold">Cancel the unpaid checkout?</h2><p>This checks Stripe before cancelling. A paid or processing payment will not be cancelled here. Your cart stays available. If payment status is uncertain, wait for confirmation before paying again.</p>{orderError&&<p role="alert" className="text-red-300">{orderError}</p>}<button type="button" disabled={isCreatingOrder} className="btn-secondary" onClick={cancelCheckout}>Cancel unpaid checkout and edit</button><button type="button" disabled={isCreatingOrder} className="underline ml-4" onClick={()=>setCancelReview(false)}>Keep checkout</button></section>}
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
                            <p className="text-green-400/70 text-xs">Your loyalty discount of {formatPrice(loyaltyDiscountCents)} will be applied automatically.</p>
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
                      <div>
                        <label htmlFor="hearAboutUs" className="block text-gray-400 text-sm mb-1">How did you hear about us? (optional)</label>
                        <select
                          id="hearAboutUs"
                          name="hearAboutUs"
                          value={formData.hearAboutUs}
                          onChange={handleChange}
                          className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        >
                          <option value="">Select an option</option>
                          <option value="Google / search engine">Google / search engine</option>
                          <option value="Social media (Facebook / Instagram)">Social media (Facebook / Instagram)</option>
                          <option value="Friend / referral">Friend / referral</option>
                          <option value="YouTube">YouTube</option>
                          <option value="Online forum / community">Online forum / community</option>
                          <option value="Repeat customer">Repeat customer</option>
                          <option value="Other">Other</option>
                        </select>
                        {import.meta.env.VITE_REFERRAL_REWARDS_ENABLED === 'true' && <div className="my-4">
                        <label htmlFor="referralCode" className="block text-sm text-gray-300 mb-2">Referral code (optional)</label>
                        <input id="referralCode" value={referralCode} onChange={e=>setReferralCode(e.target.value.toUpperCase())} maxLength={24} className="input-field w-full" autoComplete="off" />
                        <p className="text-xs text-gray-400 mt-2">A valid code gives its configured first-order product discount, shown in your verified total. It combines with the applicable coupon or repeat-price discount, up to the product price. Only your first paid order qualifies; use the same email for future orders.</p><p className="text-xs text-gray-400 mt-2">Using this code lets the referrer see your name, eligible product spending after discounts, and commission details in their statements. This applies to this order and future orders using the same email. Your email, address, tax, shipping and payment details are not included.</p>
                      </div>}
                      {formData.hearAboutUs === 'Other' && (
                          <input
                            type="text"
                            id="hearAboutUsOther"
                            name="hearAboutUsOther"
                            value={formData.hearAboutUsOther}
                            onChange={handleChange}
                            placeholder="Please tell us"
                            className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 mt-3 focus:border-yellow-500 focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-industrial text-yellow-500 mb-6">SHIPPING ADDRESS</h2>
                    <div className="bg-blue-500/10 border border-blue-500/40 px-4 py-3 mb-4 rounded text-sm text-blue-300">
                      <p>
                        <span aria-hidden="true">🇨🇦 </span>
                        <span className="font-bold">Ordering from Canada?</span>{' '}
                        Please contact our Canadian partner, Royal Rigging, at <a href="tel:+16043292214" className="underline hover:text-blue-200">604-329-2214</a> or <a href="mailto:orders@royalrigging.ca" className="underline hover:text-blue-200">orders@royalrigging.ca</a> instead of ordering here. <Link to="/contact#canada" className="underline hover:text-blue-200">More info</Link>
                      </p>
                    </div>
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

                  {orderError && !pendingDraft && (
                    <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 mb-8">
                      {orderError}
                    </div>
                  )}

                  <BuyerEmailVerification email={formData.email} required={verificationRequired} onProof={setBuyerProof}/>

                  <button
                    type="submit"
                    disabled={isCreatingOrder || isCalculatingTax || !quoteReady || !!taxError || verificationRequired&&!buyerProofValid}
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
                        type="button" onClick={() => setCancelReview(true)}
                        className="text-yellow-500 hover:text-yellow-400 text-sm"
                      >
                        Review changes
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
                        items={summaryItems}
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
                <CheckoutOrderItems items={summaryItems} pricesLocked={!!quoteReady} />

                {/* Discount code (only on step 1 — once we have a clientSecret the amount is locked) */}
                {step === 1 && !isRepeatCustomer && (
                  <div className="border-t border-gray-700 pt-4 mb-4">
                    {!showCodeInput && !appliedCode && (
                      <button
                        type="button"
                        onClick={() => setShowCodeInput(true)}
                        className="text-yellow-500 hover:text-yellow-400 text-sm"
                      >
                        Have a discount code?
                      </button>
                    )}
                    {showCodeInput && !appliedCode && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value)}
                            placeholder="Enter code"
                            className="flex-1 bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm uppercase focus:border-yellow-500 focus:outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCode}
                            disabled={validatingCode}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold disabled:opacity-50"
                          >
                            {validatingCode ? '...' : 'Apply'}
                          </button>
                        </div>
                        {codeError && <p className="text-red-400 text-xs">{codeError}</p>}
                      </div>
                    )}
                    {appliedCode && (
                      <div className="flex justify-between items-center bg-green-500/10 border border-green-500/30 px-3 py-2">
                        <div>
                          {recoveryDiscountCode === appliedCode && (
                            <p className="text-green-400/90 text-xs mb-0.5">Welcome back — recovery discount applied automatically</p>
                          )}
                          <p className="text-green-400 text-sm font-bold">{appliedCode} applied</p>
                          <p className="text-green-400/70 text-xs">{appliedCodePercentOff}% off</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedCode(null)
                            setAppliedCodePercentOff(0)
                            setCodeInput('')
                            setShowCodeInput(false)
                          }}
                          className="text-gray-400 hover:text-white text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-3 border-t border-gray-700 pt-4">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span className="text-white">{formatPrice(subtotal)}</span>
                  </div>
                  {discountCents > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>
                        {discountSource === 'combined' ? 'Combined product discounts' : discountSource === 'referral' ? 'Referral product discount' : discountSource === 'loyalty'
                          ? 'Loyalty Discount (10%)'
                          : `Discount (${appliedCode})`}
                      </span>
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
                    ) : taxQuoted || step===2&&paymentSnapshot ? (
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

                <PolicyLinks className="mt-6" />

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
