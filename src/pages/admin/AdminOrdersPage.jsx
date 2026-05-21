import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, getPriceForQuantity, MIN_ORDER_QUANTITY, PRODUCT_PRICING } from '../../stores/cartStore'
import { useInventory, updateStock } from '../../hooks/useInventory'
import { useProducts } from '../../hooks/useProducts'

function getEmptyManualForm() {
  // datetime-local needs YYYY-MM-DDTHH:MM in local time, not ISO/UTC.
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  return {
    productId: '1',
    name: '',
    email: '',
    phone: '',
    saleDate: localNow,
    quantity: '',
    unitPriceCents: '',
    unitPriceManuallyEdited: false,
    discountCents: '',
    discountReason: '',
    shippingCents: '',
    paymentMethod: 'cash',
    hasShipping: false,
    address1: '', address2: '', city: '', state: '', zip: '', country: 'US',
    taxCents: '',
    taxCalculationId: null,
  }
}

function AdminOrdersPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('confirmed')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingCarrier, setTrackingCarrier] = useState('ups')
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingEmailStatus, setTrackingEmailStatus] = useState(null) // 'sent', 'failed', null

  // Inventory state — admin picks which product to manage stock for.
  const { activeProducts, productsMap } = useProducts()
  const [stockProductId, setStockProductId] = useState('1')
  const { stock, loading: stockLoading, refetch: refetchStock } = useInventory(stockProductId)
  const [stockInput, setStockInput] = useState('')
  const [savingStock, setSavingStock] = useState(false)
  const [stockSaved, setStockSaved] = useState(false)

  // Shipping cost state (per-order)
  const [shippingCostInput, setShippingCostInput] = useState('')
  const [savingShippingCost, setSavingShippingCost] = useState(false)
  const [shippingCostSaved, setShippingCostSaved] = useState(false)

  // Delete order state
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Manual order entry state
  const [showManualModal, setShowManualModal] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [manualError, setManualError] = useState(null)
  const [manualForm, setManualForm] = useState(getEmptyManualForm())
  const [calculatingManualTax, setCalculatingManualTax] = useState(false)
  const [manualTaxError, setManualTaxError] = useState(null)

  useEffect(() => {
    // Reset the input when switching products or when stock first loads so
    // the editor always reflects the actually-selected product's stock.
    if (stock !== null) setStockInput(String(stock))
    setStockSaved(false)
  }, [stock, stockProductId])

  useEffect(() => {
    if (selectedOrder) {
      if (selectedOrder.actual_shipping_cost_cents != null) {
        setShippingCostInput((selectedOrder.actual_shipping_cost_cents / 100).toFixed(2))
      } else {
        setShippingCostInput('')
      }
      setShippingCostSaved(false)
      setConfirmDelete(null)
    }
  }, [selectedOrder?.id])

  const handleStockSave = async () => {
    const qty = parseInt(stockInput)
    if (isNaN(qty) || qty < 0) return
    setSavingStock(true)
    setStockSaved(false)
    const { error } = await updateStock(stockProductId, qty)
    if (!error) {
      setStockSaved(true)
      refetchStock()
      setTimeout(() => setStockSaved(false), 2000)
    }
    setSavingStock(false)
  }

  const adjustStock = (delta) => {
    const current = parseInt(stockInput) || 0
    const newVal = Math.max(0, current + delta)
    setStockInput(String(newVal))
  }

  // Auto-fill the unit-price field with the volume-pricing tier whenever
  // quantity or product changes, unless the admin has manually overridden it.
  const onManualQuantityChange = (val) => {
    const qty = parseInt(val) || 0
    const next = { ...manualForm, quantity: val }
    if (!manualForm.unitPriceManuallyEdited && qty > 0) {
      next.unitPriceCents = String(getPriceForQuantity(manualForm.productId, qty))
    }
    setManualForm(next)
  }

  const onManualProductChange = (pid) => {
    const qty = parseInt(manualForm.quantity) || 0
    const next = { ...manualForm, productId: pid }
    if (!manualForm.unitPriceManuallyEdited && qty > 0) {
      next.unitPriceCents = String(getPriceForQuantity(pid, qty))
    }
    setManualForm(next)
  }

  const onManualUnitPriceChange = (val) => {
    setManualForm({ ...manualForm, unitPriceCents: val, unitPriceManuallyEdited: true })
  }

  // Manual orders may lack a shipping address (in-person handoff). For those,
  // fall back to the business's home jurisdiction so the admin can still
  // record the sale to Stripe Tax for filing reports. Update this default if
  // the business location ever moves.
  const BUSINESS_DEFAULT_ADDRESS = {
    line1: '',
    city: 'Houston',
    state: 'TX',
    postal_code: '77001',
    country: 'US',
  }

  const calculateManualTax = async () => {
    setManualTaxError(null)
    const qty = parseInt(manualForm.quantity)
    const unitPrice = parseInt(manualForm.unitPriceCents)
    if (isNaN(qty) || qty <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
      setManualTaxError('Set quantity and unit price first.')
      return
    }

    const address = manualForm.hasShipping && manualForm.zip
      ? {
          line1: manualForm.address1, line2: manualForm.address2,
          city: manualForm.city, state: manualForm.state,
          postal_code: manualForm.zip, country: manualForm.country,
        }
      : BUSINESS_DEFAULT_ADDRESS

    setCalculatingManualTax(true)
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
            items: [{
              productId: manualForm.productId,
              name: productsMap[manualForm.productId]?.name || PRODUCT_PRICING[manualForm.productId]?.name || 'Product',
              quantity: qty,
            }],
            shippingAddress: address,
            discountCents: parseInt(manualForm.discountCents) || 0,
          }),
        }
      )
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setManualForm({
        ...manualForm,
        taxCents: String(data.taxCents || 0),
        taxCalculationId: data.calculationId,
      })
    } catch (err) {
      setManualTaxError(err.message || 'Tax calculation failed.')
    } finally {
      setCalculatingManualTax(false)
    }
  }

  const submitManualOrder = async (e) => {
    e.preventDefault()
    setManualError(null)

    const qty = parseInt(manualForm.quantity)
    const unitPrice = parseInt(manualForm.unitPriceCents)
    if (!manualForm.name.trim()) return setManualError('Customer name is required.')
    if (isNaN(qty) || qty < MIN_ORDER_QUANTITY) return setManualError(`Quantity must be at least ${MIN_ORDER_QUANTITY}.`)
    if (isNaN(unitPrice) || unitPrice <= 0) return setManualError('Unit price must be greater than 0.')

    const discountCents = parseInt(manualForm.discountCents) || 0
    const shippingCents = parseInt(manualForm.shippingCents) || 0
    const taxCents = parseInt(manualForm.taxCents) || 0
    const subtotalCents = qty * unitPrice
    const totalCents = subtotalCents - discountCents + shippingCents + taxCents
    if (totalCents < 0) return setManualError('Discount cannot exceed subtotal + shipping + tax.')

    const saleDateIso = new Date(manualForm.saleDate).toISOString()
    const productName = productsMap[manualForm.productId]?.name || PRODUCT_PRICING[manualForm.productId]?.name || 'Product'
    const items = [{ productId: manualForm.productId, name: productName, quantity: qty, price: unitPrice }]
    const shippingAddress = manualForm.hasShipping
      ? {
          address1: manualForm.address1, address2: manualForm.address2,
          city: manualForm.city, state: manualForm.state, zip: manualForm.zip, country: manualForm.country,
        }
      : null

    setSavingManual(true)

    // Two-step: insert as pending, then flip to paid so the
    // orders_decrement_stock_trigger fires and decrements inventory.
    const { data: inserted, error: insertError } = await supabase
      .from('orders')
      .insert([{
        name: manualForm.name.trim(),
        email: manualForm.email.trim() || null,
        phone: manualForm.phone.trim() || null,
        shipping_address: shippingAddress,
        items,
        subtotal_cents: subtotalCents,
        discount_cents: discountCents || null,
        discount_reason: manualForm.discountReason.trim() || null,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        stripe_tax_calculation_id: manualForm.taxCalculationId,
        total_cents: totalCents,
        status: 'confirmed',
        payment_status: 'pending',
        payment_method: manualForm.paymentMethod,
        created_at: saleDateIso,
        updated_at: saleDateIso,
      }])
      .select()
      .single()

    if (insertError) {
      setSavingManual(false)
      return setManualError(`Failed to create order: ${insertError.message}`)
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', inserted.id)

    if (updateError) {
      setSavingManual(false)
      return setManualError(`Order created but payment flip failed: ${updateError.message}. Stock not decremented.`)
    }

    // Finalize the Stripe Tax calculation into a transaction so this manual
    // sale appears in Stripe Tax filing reports. The stripe-webhook only fires
    // for Stripe-processed payments, so manual orders need this explicit call.
    // Failure here doesn't roll back the order — the admin can retry later.
    if (manualForm.taxCalculationId) {
      try {
        await supabase.functions.invoke('finalize-tax-transaction', {
          body: { calculationId: manualForm.taxCalculationId, orderId: inserted.id },
        })
      } catch (taxErr) {
        console.error('Manual order tax finalization failed:', taxErr)
      }
    }

    setSavingManual(false)
    setShowManualModal(false)
    setManualForm(getEmptyManualForm())
    fetchOrders()
    refetchStock()
  }

  const handleShippingCostSave = async () => {
    if (!selectedOrder) return
    const val = shippingCostInput.trim()
    const parsed = parseFloat(val)
    if (isNaN(parsed) || parsed < 0) return
    setSavingShippingCost(true)
    setShippingCostSaved(false)
    const costCents = Math.round(parsed * 100)
    const { error } = await supabase
      .from('orders')
      .update({ actual_shipping_cost_cents: costCents, updated_at: new Date().toISOString() })
      .eq('id', selectedOrder.id)
    if (!error) {
      const updated = { ...selectedOrder, actual_shipping_cost_cents: costCents }
      setSelectedOrder(updated)
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, actual_shipping_cost_cents: costCents } : o))
      setShippingCostSaved(true)
      setTimeout(() => setShippingCostSaved(false), 2000)
    }
    setSavingShippingCost(false)
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/admin/login')
      return
    }
    fetchOrders()
  }

  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching orders:', error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (!error) {
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus })
      }
    }
  }

  const deleteOrder = async (orderId) => {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)

    if (error) {
      console.error('Delete failed:', error)
      alert(`Failed to delete order: ${error.message}`)
    } else {
      setOrders(orders.filter(o => o.id !== orderId))
      setSelectedOrder(null)
      setConfirmDelete(null)
    }
  }

  const getTrackingUrl = (carrier, number) => {
    if (!number) return null
    switch (carrier) {
      case 'ups': return `https://www.ups.com/track?tracknum=${number}`
      case 'usps': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`
      default: return null
    }
  }

  const saveTracking = async (orderId) => {
    if (!trackingNumber.trim()) return
    setSavingTracking(true)
    setTrackingEmailStatus(null)
    const { error } = await supabase
      .from('orders')
      .update({
        tracking_number: trackingNumber.trim(),
        tracking_carrier: trackingCarrier,
        status: 'shipped',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (!error) {
      const updated = { ...selectedOrder, tracking_number: trackingNumber.trim(), tracking_carrier: trackingCarrier, status: 'shipped' }
      setSelectedOrder(updated)
      setOrders(orders.map(o => o.id === orderId ? { ...o, tracking_number: trackingNumber.trim(), tracking_carrier: trackingCarrier, status: 'shipped' } : o))

      // Send tracking email to customer
      try {
        const { error: emailError } = await supabase.functions.invoke('send-tracking-email', {
          body: {
            customerEmail: selectedOrder.email,
            customerName: selectedOrder.name,
            trackingNumber: trackingNumber.trim(),
            trackingCarrier: trackingCarrier,
            orderId: orderId,
          }
        })
        setTrackingEmailStatus(emailError ? 'failed' : 'sent')
      } catch {
        setTrackingEmailStatus('failed')
      }

      setTrackingNumber('')
    }
    setSavingTracking(false)
  }

  const copyAddress = (order) => {
    const addr = order.shipping_address
    const addressText = `${order.name}
${order.company ? order.company + '\n' : ''}${addr.address1}
${addr.address2 ? addr.address2 + '\n' : ''}${addr.city}, ${addr.state} ${addr.zip}
${addr.country}`
    navigator.clipboard.writeText(addressText)
    setCopiedId(order.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/20 text-green-400 border-green-500'
      case 'shipped': return 'bg-blue-500/20 text-blue-400 border-blue-500'
      case 'delivered': return 'bg-purple-500/20 text-purple-400 border-purple-500'
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500'
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500'
    }
  }

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'text-green-400'
      case 'failed': return 'text-red-400'
      default: return 'text-yellow-400'
    }
  }

  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (paymentFilter !== 'all' && o.payment_status !== paymentFilter) return false
    return true
  })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ktodd-dark flex items-center justify-center">
        <div className="text-yellow-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ktodd-dark">
      {/* Admin Header */}
      <header className="bg-ktodd-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="flex items-center gap-2">
                <img src="/logos/icon.png" alt="Driveshaft Cable" className="w-8 h-8 rounded" />
                <span className="text-yellow-500 font-industrial">ADMIN</span>
              </Link>
            </div>
            <button
              onClick={handleSignOut}
              className="text-gray-400 hover:text-red-500 transition-colors text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 min-h-[calc(100vh-4rem)] border-r border-gray-800 hidden md:block">
          <nav className="p-4 space-y-2">
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <Link to="/admin/orders" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Orders
              {orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length > 0 && (
                <span className="ml-auto bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length}
                </span>
              )}
            </Link>
            <Link to="/admin/quotes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Quotes
            </Link>
            <Link to="/admin/suggestions" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Suggestions
            </Link>
            <Link to="/admin/testimonials" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Testimonials
            </Link>
            <Link to="/admin/email" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Blast
            </Link>
            <Link to="/admin/analytics" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </Link>
            <Link to="/admin/newsletter" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Newsletter
            </Link>
            <Link to="/admin/blog" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Blog
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-industrial text-white">ORDERS</h1>
                <button
                  onClick={() => { setManualForm(getEmptyManualForm()); setManualError(null); setShowManualModal(true) }}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                  </svg>
                  ADD MANUAL ORDER
                </button>
              </div>

              {/* Status Tabs — Confirmed is the default workflow; Pending is
                  online-only abandoned checkouts; All shows everything. */}
              {(() => {
                const pendingCount = orders.filter(o => o.status === 'pending').length
                const tabs = [
                  { value: 'confirmed', label: 'Confirmed' },
                  { value: 'pending',   label: 'Pending', badge: pendingCount },
                  { value: 'all',       label: 'All' },
                ]
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {tabs.map(t => {
                      const isActive = statusFilter === t.value
                      return (
                        <button
                          key={t.value}
                          onClick={() => setStatusFilter(t.value)}
                          className={`px-4 py-2 text-sm font-bold rounded transition-colors ${
                            isActive
                              ? 'bg-yellow-500 text-black'
                              : 'bg-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          {t.label}
                          {t.badge > 0 && (
                            <span className={`ml-2 inline-block px-2 py-0.5 text-xs rounded-full ${
                              isActive ? 'bg-black/30 text-black' : 'bg-yellow-500 text-black'
                            }`}>
                              {t.badge}
                            </span>
                          )}
                        </button>
                      )
                    })}
                    <span className="text-gray-400 text-sm ml-2">Payment:</span>
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm rounded"
                    >
                      <option value="all">All</option>
                      <option value="paid">Paid</option>
                      <option value="pending">Unpaid</option>
                      <option value="failed">Failed</option>
                    </select>
                    <button
                      onClick={fetchOrders}
                      className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"
                      title="Refresh"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* Inventory Management */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-industrial text-yellow-500">INVENTORY</h2>
                <div className="flex items-center gap-2">
                  <label className="text-gray-400 text-sm">Product:</label>
                  <select
                    value={stockProductId}
                    onChange={(e) => setStockProductId(e.target.value)}
                    className="bg-gray-800 border border-gray-600 text-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none"
                  >
                    {activeProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Current Stock Display */}
                <div className="text-center">
                  <div className="text-gray-400 text-sm mb-1">Current Stock</div>
                  <div className={`text-5xl font-industrial ${
                    stockLoading ? 'text-gray-500' : stock === 0 ? 'text-red-400' : stock <= 20 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {stockLoading ? '...' : stock ?? '--'}
                  </div>
                </div>

                {/* Stock Controls */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => adjustStock(-10)} className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 text-sm font-bold transition-colors">-10</button>
                    <button onClick={() => adjustStock(-1)} className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 text-sm font-bold transition-colors">-1</button>
                    <input
                      type="number"
                      value={stockInput}
                      onChange={(e) => setStockInput(e.target.value)}
                      min="0"
                      className="w-24 text-center bg-gray-800 border border-gray-600 text-white px-3 py-2 text-lg font-mono focus:border-yellow-500 focus:outline-none"
                    />
                    <button onClick={() => adjustStock(1)} className="px-3 py-2 bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 text-sm font-bold transition-colors">+1</button>
                    <button onClick={() => adjustStock(10)} className="px-3 py-2 bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 text-sm font-bold transition-colors">+10</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleStockSave}
                      disabled={savingStock || stockInput === String(stock)}
                      className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingStock ? 'Saving...' : 'Save Stock'}
                    </button>
                    {stockSaved && (
                      <span className="text-green-400 text-sm flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            {orders.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/30 p-4">
                  <div className="text-green-400 text-2xl font-industrial">{orders.filter(o => o.payment_status === 'paid').length}</div>
                  <div className="text-gray-400 text-sm">Paid</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4">
                  <div className="text-yellow-400 text-2xl font-industrial">{orders.filter(o => o.payment_status === 'pending' || !o.payment_status).length}</div>
                  <div className="text-gray-400 text-sm">Unpaid</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 p-4">
                  <div className="text-red-400 text-2xl font-industrial">{orders.filter(o => o.payment_status === 'failed').length}</div>
                  <div className="text-gray-400 text-sm">Failed</div>
                </div>
              </div>
            )}

            {orders.length === 0 ? (
              /* Empty State */
              <div className="bg-gray-800/50 border border-gray-700 p-12 text-center">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h2 className="text-xl font-industrial text-white mb-2">NO ORDERS YET</h2>
                <p className="text-gray-400 mb-6">Orders will appear here once customers start placing them.</p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Orders List */}
                <div className="space-y-4">
                  <h2 className="text-lg font-industrial text-gray-400">
                    {filteredOrders.length} {statusFilter === 'all' ? 'Total' : statusFilter} Order{filteredOrders.length !== 1 ? 's' : ''}
                  </h2>

                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`bg-gray-800/50 border p-4 cursor-pointer transition-all ${
                        selectedOrder?.id === order.id
                          ? 'border-yellow-500'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-white font-bold">{order.name}</p>
                          <p className="text-gray-400 text-sm">{order.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {order.payment_method && order.payment_method !== 'stripe' && (
                            <span className="px-2 py-1 text-xs border rounded bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                              {order.payment_method.toUpperCase()}
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs border rounded ${getStatusColor(order.status)}`}>
                            {order.status?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{formatDate(order.created_at)}</span>
                        <span className="text-yellow-500 font-bold">{formatPrice(order.total_cents)}</span>
                      </div>
                      <div className="mt-2 text-sm flex items-center gap-2">
                        {order.payment_status !== 'paid' && (
                          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                        <span className={getPaymentStatusColor(order.payment_status)}>
                          Payment: {order.payment_status === 'paid' ? 'PAID' : order.payment_status === 'failed' ? 'FAILED' : 'UNPAID'}
                        </span>
                        {order.tracking_number && (
                          <span className="ml-auto text-blue-400 text-xs flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                            </svg>
                            {order.tracking_carrier?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Detail */}
                <div className="lg:sticky lg:top-24 h-fit">
                  {selectedOrder ? (
                    <div className="bg-gray-800/50 border border-gray-700 p-6">
                      <div className="flex items-start justify-between mb-6">
                        <h2 className="text-xl font-industrial text-yellow-500">ORDER DETAILS</h2>
                        <button
                          onClick={() => setSelectedOrder(null)}
                          className="text-gray-400 hover:text-white lg:hidden"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Order ID & Date */}
                      <div className="mb-6 pb-6 border-b border-gray-700">
                        <p className="text-gray-400 text-sm">Order ID</p>
                        <p className="text-white font-mono text-sm">{selectedOrder.id}</p>
                        <p className="text-gray-400 text-sm mt-2">Placed</p>
                        <p className="text-white">{formatDate(selectedOrder.created_at)}</p>
                      </div>

                      {/* Customer Info */}
                      <div className="mb-6 pb-6 border-b border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400 mb-3">CUSTOMER</h3>
                        <p className="text-white">{selectedOrder.name}</p>
                        {selectedOrder.company && (
                          <p className="text-gray-300">{selectedOrder.company}</p>
                        )}
                        <p className="text-gray-300">{selectedOrder.email}</p>
                        {selectedOrder.phone && (
                          <p className="text-gray-300">{selectedOrder.phone}</p>
                        )}
                      </div>

                      {/* Shipping Address */}
                      <div className="mb-6 pb-6 border-b border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-gray-400">SHIPPING ADDRESS</h3>
                          <button
                            onClick={() => copyAddress(selectedOrder)}
                            className={`flex items-center gap-1 text-sm transition-colors ${
                              copiedId === selectedOrder.id
                                ? 'text-green-400'
                                : 'text-yellow-500 hover:text-yellow-400'
                            }`}
                          >
                            {copiedId === selectedOrder.id ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Address
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-gray-900 p-3 text-gray-300 text-sm">
                          <p>{selectedOrder.name}</p>
                          {selectedOrder.company && <p>{selectedOrder.company}</p>}
                          <p>{selectedOrder.shipping_address?.address1}</p>
                          {selectedOrder.shipping_address?.address2 && (
                            <p>{selectedOrder.shipping_address.address2}</p>
                          )}
                          <p>
                            {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} {selectedOrder.shipping_address?.zip}
                          </p>
                          <p>{selectedOrder.shipping_address?.country}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mb-6 pb-6 border-b border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400 mb-3">ITEMS</h3>
                        {selectedOrder.items?.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm py-2">
                            <span className="text-gray-300">{item.quantity}x {item.name}</span>
                            <span className="text-white">{formatPrice(item.price * item.quantity)}</span>
                          </div>
                        ))}
                        {selectedOrder.discount_cents > 0 && (
                          <div className="flex justify-between text-sm pt-2 border-t border-gray-700 mt-2">
                            <span className="text-green-400">Loyalty Discount (10%)</span>
                            <span className="text-green-400 font-bold">-{formatPrice(selectedOrder.discount_cents)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-700 mt-2">
                          <span className="text-gray-400">Shipping</span>
                          <span className={selectedOrder.shipping_cents > 0 ? 'text-white' : 'text-green-400'}>
                            {selectedOrder.shipping_cents > 0 ? formatPrice(selectedOrder.shipping_cents) : 'FREE'}
                          </span>
                        </div>
                        {selectedOrder.tax_cents > 0 && (
                          <div className="flex justify-between text-sm pt-2">
                            <span className="text-gray-400">Tax</span>
                            <span className="text-white">{formatPrice(selectedOrder.tax_cents)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold pt-2">
                          <span className="text-white">Total</span>
                          <span className="text-yellow-500">{formatPrice(selectedOrder.total_cents)}</span>
                        </div>
                        {selectedOrder.stripe_tax_transaction_id && (
                          <div className="text-xs text-gray-500 pt-2 flex justify-between">
                            <span>Stripe Tax txn</span>
                            <span className="font-mono">{selectedOrder.stripe_tax_transaction_id}</span>
                          </div>
                        )}
                      </div>

                      {/* Tracking */}
                      <div className="mb-6 pb-6 border-b border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400 mb-3">TRACKING</h3>
                        {selectedOrder.tracking_number ? (
                          <div className="space-y-3">
                            <div className="bg-gray-900 p-3 flex items-center justify-between">
                              <div>
                                <span className="text-gray-400 text-xs uppercase">{selectedOrder.tracking_carrier?.toUpperCase()}</span>
                                <p className="text-white font-mono text-sm">{selectedOrder.tracking_number}</p>
                              </div>
                              <a
                                href={getTrackingUrl(selectedOrder.tracking_carrier, selectedOrder.tracking_number)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold transition-colors flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Track
                              </a>
                            </div>
                            <button
                              onClick={() => {
                                setTrackingNumber(selectedOrder.tracking_number)
                                setTrackingCarrier(selectedOrder.tracking_carrier || 'ups')
                                setSelectedOrder({ ...selectedOrder, tracking_number: null })
                              }}
                              className="text-gray-500 hover:text-yellow-500 text-xs transition-colors"
                            >
                              Update tracking
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <select
                              value={trackingCarrier}
                              onChange={(e) => setTrackingCarrier(e.target.value)}
                              className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-3 text-sm rounded"
                            >
                              <option value="ups">UPS</option>
                              <option value="usps">USPS</option>
                            </select>
                            <input
                              type="text"
                              value={trackingNumber}
                              onChange={(e) => setTrackingNumber(e.target.value)}
                              placeholder="Enter tracking number"
                              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-4 text-base rounded focus:border-yellow-500 focus:outline-none font-mono"
                            />
                            <button
                              onClick={() => saveTracking(selectedOrder.id)}
                              disabled={!trackingNumber.trim() || savingTracking}
                              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingTracking ? 'Saving & Emailing Customer...' : 'Save & Email Customer'}
                            </button>
                            {trackingEmailStatus === 'sent' && (
                              <div className="flex items-center gap-2 text-green-400 text-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Tracking email sent to customer
                              </div>
                            )}
                            {trackingEmailStatus === 'failed' && (
                              <div className="flex items-center gap-2 text-red-400 text-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Tracking saved but email failed to send
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Shipping Cost */}
                      <div className="mb-6 pb-6 border-b border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400 mb-3">SHIPPING COST</h3>
                        <div className="text-xs text-gray-500 mb-2">
                          Current:{' '}
                          {selectedOrder.actual_shipping_cost_cents != null
                            ? formatPrice(selectedOrder.actual_shipping_cost_cents)
                            : 'Not entered'}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={shippingCostInput}
                              onChange={(e) => setShippingCostInput(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-gray-800 border border-gray-700 text-white pl-7 pr-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={handleShippingCostSave}
                            disabled={savingShippingCost || shippingCostInput.trim() === ''}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {savingShippingCost ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                        {shippingCostSaved && (
                          <div className="flex items-center gap-1 text-green-400 text-sm mt-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Saved!
                          </div>
                        )}
                      </div>

                      {/* Status Update */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-400 mb-3">UPDATE STATUS</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => (
                            <button
                              key={status}
                              onClick={() => updateOrderStatus(selectedOrder.id, status)}
                              className={`px-3 py-2 text-sm border rounded transition-colors ${
                                selectedOrder.status === status
                                  ? getStatusColor(status)
                                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
                              }`}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Delete Order */}
                      <div className="border-t border-gray-700 pt-4 mt-4">
                        {confirmDelete === selectedOrder.id ? (
                          <div>
                            <p className="text-red-400 text-sm mb-3">
                              Delete order from <span className="font-bold">{selectedOrder.name}</span>? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => deleteOrder(selectedOrder.id)}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white px-3 py-2 text-sm font-bold rounded transition-colors"
                              >
                                Yes, Delete
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 text-sm font-bold rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(selectedOrder.id)}
                            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-400 px-3 py-2 text-sm border border-gray-700 hover:border-red-800 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Order
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-800/50 border border-gray-700 p-12 text-center">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <p className="text-gray-400">Select an order to view details</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={submitManualOrder}
            className="bg-ktodd-dark border border-yellow-500 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 sticky top-0 bg-ktodd-dark">
              <h2 className="text-xl font-industrial text-yellow-500">ADD MANUAL ORDER</h2>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Customer name *</label>
                <input
                  type="text"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  required
                  placeholder="Walk-in customer"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Sale date *</label>
                  <input
                    type="datetime-local"
                    value={manualForm.saleDate}
                    onChange={(e) => setManualForm({ ...manualForm, saleDate: e.target.value })}
                    required
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Payment method *</label>
                  <select
                    value={manualForm.paymentMethod}
                    onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="zelle">Zelle</option>
                    <option value="cashapp">CashApp</option>
                    <option value="stripe">Stripe link (incurs 2.9% + $0.30 fee)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Product *</label>
                <select
                  value={manualForm.productId}
                  onChange={(e) => onManualProductChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                >
                  {activeProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={MIN_ORDER_QUANTITY}
                    value={manualForm.quantity}
                    onChange={(e) => onManualQuantityChange(e.target.value)}
                    required
                    placeholder={`min ${MIN_ORDER_QUANTITY}`}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Unit price (cents) *{' '}
                    <span className="text-gray-500 text-xs">
                      ({manualForm.unitPriceCents ? formatPrice(parseInt(manualForm.unitPriceCents) || 0) : '—'} each)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={manualForm.unitPriceCents}
                    onChange={(e) => onManualUnitPriceChange(e.target.value)}
                    required
                    placeholder="auto-fills from volume tier"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Discount (cents, optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={manualForm.discountCents}
                    onChange={(e) => setManualForm({ ...manualForm, discountCents: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Discount reason (optional)</label>
                  <input
                    type="text"
                    value={manualForm.discountReason}
                    onChange={(e) => setManualForm({ ...manualForm, discountReason: e.target.value })}
                    placeholder="e.g. negotiated"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Shipping (cents, default 0)</label>
                <input
                  type="number"
                  min="0"
                  value={manualForm.shippingCents}
                  onChange={(e) => setManualForm({ ...manualForm, shippingCents: e.target.value })}
                  placeholder="0 for in-person handoff"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualForm.hasShipping}
                  onChange={(e) => setManualForm({ ...manualForm, hasShipping: e.target.checked })}
                  className="w-4 h-4 accent-yellow-500"
                />
                Add shipping address (for orders that will be shipped)
              </label>

              {manualForm.hasShipping && (
                <div className="space-y-2 pl-6 border-l-2 border-gray-700">
                  <input
                    type="text" value={manualForm.address1}
                    onChange={(e) => setManualForm({ ...manualForm, address1: e.target.value })}
                    placeholder="Address line 1"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                  <input
                    type="text" value={manualForm.address2}
                    onChange={(e) => setManualForm({ ...manualForm, address2: e.target.value })}
                    placeholder="Address line 2"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text" value={manualForm.city}
                      onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })}
                      placeholder="City"
                      className="bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                    />
                    <input
                      type="text" value={manualForm.state}
                      onChange={(e) => setManualForm({ ...manualForm, state: e.target.value })}
                      placeholder="State"
                      className="bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                    />
                    <input
                      type="text" value={manualForm.zip}
                      onChange={(e) => setManualForm({ ...manualForm, zip: e.target.value })}
                      placeholder="ZIP"
                      className="bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Sales tax (uses shipping address if provided, otherwise the
                  business default address in Houston, TX). Recorded to Stripe
                  Tax on submit so it appears in filing reports. */}
              <div className="bg-gray-800/50 border border-gray-700 p-3">
                <label className="block text-gray-400 text-sm mb-2">Sales tax (cents)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={manualForm.taxCents}
                    onChange={(e) => setManualForm({ ...manualForm, taxCents: e.target.value, taxCalculationId: null })}
                    placeholder="0"
                    className="flex-1 bg-gray-800 border border-gray-600 text-white px-3 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={calculateManualTax}
                    disabled={calculatingManualTax}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold whitespace-nowrap disabled:opacity-50"
                  >
                    {calculatingManualTax ? 'Calculating…' : 'Calculate Tax'}
                  </button>
                </div>
                {manualForm.taxCalculationId && (
                  <p className="text-green-400 text-xs mt-1">
                    Will be recorded to Stripe Tax reports on save.
                  </p>
                )}
                {manualTaxError && (
                  <p className="text-red-400 text-xs mt-1">{manualTaxError}</p>
                )}
                {!manualForm.hasShipping && !manualTaxError && !manualForm.taxCalculationId && (
                  <p className="text-gray-500 text-xs mt-1">
                    In-person sales use the Texas business address for tax.
                  </p>
                )}
              </div>

              {/* Live preview */}
              {(() => {
                const qty = parseInt(manualForm.quantity) || 0
                const unitPrice = parseInt(manualForm.unitPriceCents) || 0
                const subtotal = qty * unitPrice
                const discount = parseInt(manualForm.discountCents) || 0
                const ship = parseInt(manualForm.shippingCents) || 0
                const tax = parseInt(manualForm.taxCents) || 0
                const total = subtotal - discount + ship + tax
                return (
                  <div className="bg-gray-800/50 border border-gray-700 p-3 text-sm space-y-1">
                    <div className="flex justify-between text-gray-400"><span>Subtotal ({qty} × {formatPrice(unitPrice)})</span><span className="text-white">{formatPrice(subtotal)}</span></div>
                    {discount > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>-{formatPrice(discount)}</span></div>}
                    <div className="flex justify-between text-gray-400"><span>Shipping</span><span className="text-white">{formatPrice(ship)}</span></div>
                    {tax > 0 && <div className="flex justify-between text-gray-400"><span>Tax</span><span className="text-white">{formatPrice(tax)}</span></div>}
                    <div className="flex justify-between border-t border-gray-700 pt-1 mt-1"><span className="text-white font-bold">Total</span><span className="text-yellow-500 font-bold">{formatPrice(total)}</span></div>
                  </div>
                )
              })()}

              {manualError && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 text-sm">
                  {manualError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-800 px-6 py-4 sticky bottom-0 bg-ktodd-dark">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingManual}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 font-bold disabled:opacity-50"
              >
                {savingManual ? 'Saving…' : 'Create Order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default AdminOrdersPage
