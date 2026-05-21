import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../stores/cartStore'
import { useAllInventory } from '../../hooks/useInventory'
import { useProductShipments } from '../../hooks/useProductShipments'
import { useProducts } from '../../hooks/useProducts'
import { calcProfitStats } from '../../lib/costCalculations'
import { parsePirateShipFile } from '../../lib/csvParser'

function AdminDashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pendingQuotes: 0,
    totalOrders: 0,
    paidOrders: 0,
    revenue30d: 0,
    revenueAllTime: 0,
    unitsSold30d: 0,
    unitsSoldAllTime: 0,
    avgOrderValue: 0,
    recentOrders: [],
    paidOrdersList: [],
    paidLast30: [],
    pendingTestimonialCount: 0,
    recentTestimonials: [],
  })

  // Product catalog + inventory (used by every product-aware card on this page)
  const { activeProducts, productsMap, loading: productsLoading } = useProducts()
  const { inventoryMap, loading: inventoryLoading, refetch: refetchInventory } = useAllInventory()

  // Product shipments (variable cost)
  const {
    shipments,
    loading: shipmentsLoading,
    avgCostPerUnit,
    avgCostPerUnitByProduct,
    addShipment,
    deleteShipment,
  } = useProductShipments()
  const [newShipmentProductId, setNewShipmentProductId] = useState('')
  const [newShipmentQty, setNewShipmentQty] = useState('')
  const [newShipmentCost, setNewShipmentCost] = useState('')
  const [newShipmentSupplier, setNewShipmentSupplier] = useState('')
  const [savingShipment, setSavingShipment] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Default the shipment form's product picker to the first active product
  // once products load. This avoids submitting with a blank productId.
  useEffect(() => {
    if (!newShipmentProductId && activeProducts.length > 0) {
      setNewShipmentProductId(activeProducts[0].id)
    }
  }, [activeProducts, newShipmentProductId])

  // Fallback shipping cost for orders without actual_shipping_cost_cents
  const [fallbackShipping, setFallbackShipping] = useState(
    () => parseInt(localStorage.getItem('ktodd-admin-shipping-fallback') || '0')
  )

  // Bulk shipping import state
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [csvResults, setCsvResults] = useState(null)
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvApplying, setCsvApplying] = useState(false)
  const [csvApplyResults, setCsvApplyResults] = useState(null)
  const [csvCheckedRows, setCsvCheckedRows] = useState(new Set())

  // (Per-product inventory now comes from useAllInventory above so any number
  // of products from the DB are supported without re-rendering hook order.)

  useEffect(() => {
    checkAuth()
    loadStats()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/admin/login')
      return
    }
    setUser(session.user)
    setLoading(false)
  }

  const loadStats = async () => {
    const { count: quotesCount } = await supabase
      .from('quote_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading orders:', error)
      setStats(prev => ({ ...prev, pendingQuotes: quotesCount || 0 }))
      return
    }

    const allOrders = orders || []
    const paidOrders = allOrders.filter(o => o.payment_status === 'paid')

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const paidLast30 = paidOrders.filter(o => new Date(o.created_at) >= thirtyDaysAgo)

    const revenueAllTime = paidOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0)
    const revenue30d = paidLast30.reduce((sum, o) => sum + (o.total_cents || 0), 0)

    const countUnits = (orderList) => orderList.reduce((sum, o) => {
      const items = o.items || []
      return sum + items.reduce((s, item) => s + (item.quantity || 0), 0)
    }, 0)

    const unitsSoldAllTime = countUnits(paidOrders)
    const unitsSold30d = countUnits(paidLast30)
    const avgOrderValue = paidOrders.length > 0 ? Math.round(revenueAllTime / paidOrders.length) : 0

    // Testimonials: recent submitted/approved for the dashboard panel,
    // plus count of orders eligible for a testimonial request that hasn't
    // been sent yet (drives the "Send pending requests (N)" button).
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const pendingTestimonialCount = paidOrders.filter(o =>
      !o.testimonial_request_sent_at &&
      o.email &&
      new Date(o.created_at) < fourteenDaysAgo
    ).length

    const { data: recentTestimonials } = await supabase
      .from('testimonials')
      .select('id, display_name, customer_name, testimonial_text, status, approved, submitted_at')
      .neq('status', 'pending')
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(3)

    setStats({
      pendingQuotes: quotesCount || 0,
      totalOrders: allOrders.length,
      paidOrders: paidOrders.length,
      revenue30d,
      revenueAllTime,
      unitsSold30d,
      unitsSoldAllTime,
      avgOrderValue,
      recentOrders: allOrders.slice(0, 5),
      paidOrdersList: paidOrders,
      paidLast30,
      allOrders,
      pendingTestimonialCount,
      recentTestimonials: recentTestimonials || [],
    })
  }

  const [sendingTestimonials, setSendingTestimonials] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  const handleSendTestimonialRequests = async () => {
    setSendingTestimonials(true)
    setSendResult(null)
    const { data, error } = await supabase.functions.invoke('process-testimonial-queue', { body: {} })
    setSendingTestimonials(false)
    if (error) {
      setSendResult({ ok: false, message: error.message || 'Failed to send' })
      return
    }
    setSendResult({ ok: true, message: `Sent ${data?.sent ?? 0}, failed ${data?.failed ?? 0}.` })
    loadStats()
  }

  const handleFallbackShippingChange = (val) => {
    const n = parseInt(val) || 0
    setFallbackShipping(n)
    localStorage.setItem('ktodd-admin-shipping-fallback', String(n))
  }

  const handleAddShipment = async () => {
    const qty = parseInt(newShipmentQty)
    const costDollars = parseFloat(newShipmentCost)
    if (!qty || qty <= 0 || isNaN(costDollars) || costDollars <= 0) return
    if (!newShipmentProductId) return
    setSavingShipment(true)
    await addShipment({
      productId: newShipmentProductId,
      quantity: qty,
      totalCostCents: Math.round(costDollars * 100),
      supplierName: newShipmentSupplier.trim() || null
    })
    setNewShipmentQty('')
    setNewShipmentCost('')
    setNewShipmentSupplier('')
    setSavingShipment(false)
    refetchInventory()
  }

  const handleDeleteShipment = async (id) => {
    setDeletingId(id)
    await deleteShipment(id)
    setDeletingId(null)
  }

  const handleCsvParse = async () => {
    if (!csvFile) return
    setCsvParsing(true)
    setCsvResults(null)
    setCsvApplyResults(null)
    try {
      const results = await parsePirateShipFile(csvFile, stats.allOrders || [])
      setCsvResults(results)
      setCsvCheckedRows(new Set(results.matched.map(m => m.orderId)))
    } catch (err) {
      console.error('File parse error:', err)
      setCsvResults({ matched: [], unmatched: [], errors: [String(err)] })
      setCsvCheckedRows(new Set())
    }
    setCsvParsing(false)
  }

  const handleCsvApply = async () => {
    if (!csvResults) return
    setCsvApplying(true)
    setCsvApplyResults(null)
    const toApply = csvResults.matched.filter(m => csvCheckedRows.has(m.orderId))
    let updated = 0
    let failed = 0
    for (const item of toApply) {
      const updatePayload = {
        actual_shipping_cost_cents: item.shippingCostCents,
        updated_at: new Date().toISOString()
      }
      if (item.trackingNumber) {
        updatePayload.tracking_number = item.trackingNumber
      }
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', item.orderId)
      if (error) {
        failed++
      } else {
        updated++
      }
    }
    setCsvApplyResults({ updated, failed })
    setCsvApplying(false)
    loadStats()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ktodd-dark flex items-center justify-center">
        <div className="text-yellow-500">Loading...</div>
      </div>
    )
  }

  // Count orders with/without actual shipping cost
  const ordersWithShipping = (stats.paidOrdersList || []).filter(o => o.actual_shipping_cost_cents != null).length
  const ordersTotal = (stats.paidOrdersList || []).length

  return (
    <div className="min-h-screen bg-ktodd-dark">
      {/* Admin Header */}
      <header className="bg-ktodd-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <img src="/logos/icon.png" alt="Driveshaft Cable" className="w-8 h-8 rounded" />
                <span className="text-yellow-500 font-industrial">ADMIN</span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-red-500 transition-colors text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 min-h-[calc(100vh-4rem)] border-r border-gray-800 hidden md:block">
          <nav className="p-4 space-y-2">
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <Link to="/admin/orders" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Orders
            </Link>
            <Link to="/admin/quotes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Quotes
              {stats.pendingQuotes > 0 && (
                <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
                  {stats.pendingQuotes}
                </span>
              )}
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
            <Link to="/admin/products" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Products
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
            <div className="border-t border-gray-800 my-4"></div>
            <Link to="/" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Website
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-industrial text-white mb-8">
              DASHBOARD
            </h1>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Orders</span>
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="text-3xl font-industrial text-white">{stats.totalOrders}</div>
                <span className="text-sm text-green-400">{stats.paidOrders} paid</span>
                <Link to="/admin/orders" className="text-sm text-gray-400 hover:text-yellow-500 mt-1 block">
                  View all →
                </Link>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Revenue (30d)</span>
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-3xl font-industrial text-green-400">{formatPrice(stats.revenue30d)}</div>
                <span className="text-sm text-gray-400">{stats.unitsSold30d} units sold</span>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Pending Quotes</span>
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="text-3xl font-industrial text-yellow-500">{stats.pendingQuotes}</div>
                <Link to="/admin/quotes" className="text-sm text-gray-400 hover:text-yellow-500 mt-2 inline-block">
                  View all →
                </Link>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400 text-sm">Stock Levels</span>
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="space-y-2">
                  {activeProducts.map(p => {
                    const inv = inventoryMap[p.id]
                    const s = inv?.stock ?? null
                    const colorClass = inventoryLoading
                      ? 'text-gray-500'
                      : s === 0
                      ? 'text-red-400'
                      : s !== null && s <= 20
                      ? 'text-yellow-400'
                      : 'text-white'
                    return (
                      <div key={p.id} className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-400 truncate pr-2">
                          {p.name}
                        </span>
                        <span className={`text-2xl font-industrial ${colorClass}`}>
                          {inventoryLoading ? '...' : s ?? '--'}
                        </span>
                      </div>
                    )
                  })}
                  {!productsLoading && activeProducts.length === 0 && (
                    <div className="text-xs text-gray-500">No products yet.</div>
                  )}
                </div>
                <Link to="/admin/orders" className="text-sm text-gray-400 hover:text-yellow-500 mt-3 inline-block">
                  Manage →
                </Link>
              </div>
            </div>

            {/* Revenue Insights */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">REVENUE INSIGHTS</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <div className="text-gray-400 text-sm mb-1">All-Time Revenue</div>
                  <div className="text-2xl font-industrial text-white">{formatPrice(stats.revenueAllTime)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Last 30 Days</div>
                  <div className="text-2xl font-industrial text-green-400">{formatPrice(stats.revenue30d)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Avg Order Value</div>
                  <div className="text-2xl font-industrial text-white">{stats.paidOrders > 0 ? formatPrice(stats.avgOrderValue) : '--'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Total Units Sold</div>
                  <div className="text-2xl font-industrial text-white">{stats.unitsSoldAllTime}</div>
                </div>
              </div>
            </div>

            {/* Product Shipments */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <h2 className="text-xl font-industrial text-yellow-500">PRODUCT SHIPMENTS</h2>
                <div className="text-right">
                  <div className="text-gray-400 text-xs mb-1">Weighted Avg Cost/Unit</div>
                  {activeProducts.length === 0 ? (
                    <div className="text-2xl font-industrial text-gray-500">--</div>
                  ) : (
                    <div className="space-y-1">
                      {activeProducts.map(p => {
                        const c = avgCostPerUnitByProduct[p.id]
                        return (
                          <div key={p.id} className="flex items-baseline justify-end gap-3 text-sm">
                            <span className="text-gray-400">{p.name}</span>
                            <span className={`font-industrial text-lg ${c > 0 ? 'text-white' : 'text-gray-500'}`}>
                              {c > 0 ? formatPrice(c) : '--'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {shipments.length === 0 && !shipmentsLoading && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded mb-4">
                  <p className="text-yellow-500 text-sm">No product shipments logged yet. Add your first bulk purchase below to track product costs.</p>
                </div>
              )}

              {/* Shipments Table */}
              {shipments.length > 0 && (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                        <th className="text-left py-2 pr-4">Date</th>
                        <th className="text-left py-2 px-4">Product</th>
                        <th className="text-right py-2 px-4">Qty</th>
                        <th className="text-right py-2 px-4">Total Cost</th>
                        <th className="text-right py-2 px-4">Cost/Unit</th>
                        <th className="text-left py-2 px-4">Supplier</th>
                        <th className="text-right py-2 pl-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.map(s => (
                        <tr key={s.id} className="border-b border-gray-700/50">
                          <td className="py-2 pr-4 text-gray-300">
                            {new Date(s.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-2 px-4 text-gray-300">
                            {productsMap[s.product_id]?.name || `Product ${s.product_id}`}
                          </td>
                          <td className="py-2 px-4 text-right text-white font-bold">{s.quantity}</td>
                          <td className="py-2 px-4 text-right text-white">{formatPrice(s.total_cost_cents)}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{formatPrice(Math.round(s.total_cost_cents / s.quantity))}</td>
                          <td className="py-2 px-4 text-gray-400">{s.supplier_name || '-'}</td>
                          <td className="py-2 pl-4 text-right">
                            <button
                              onClick={() => handleDeleteShipment(s.id)}
                              disabled={deletingId === s.id}
                              className="text-gray-500 hover:text-red-400 transition-colors text-xs disabled:opacity-50"
                            >
                              {deletingId === s.id ? '...' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Shipment Form */}
              <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-700">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Product</label>
                  <select
                    value={newShipmentProductId}
                    onChange={e => setNewShipmentProductId(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  >
                    {activeProducts.length === 0 && <option value="">No products</option>}
                    {activeProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newShipmentQty}
                    onChange={e => setNewShipmentQty(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm rounded w-24 focus:border-yellow-500 focus:outline-none"
                    placeholder="100"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Total Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newShipmentCost}
                    onChange={e => setNewShipmentCost(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm rounded w-32 focus:border-yellow-500 focus:outline-none"
                    placeholder="150.00"
                    min="0.01"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Supplier (optional)</label>
                  <input
                    type="text"
                    value={newShipmentSupplier}
                    onChange={e => setNewShipmentSupplier(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm rounded w-40 focus:border-yellow-500 focus:outline-none"
                    placeholder="Supplier name"
                  />
                </div>
                <button
                  onClick={handleAddShipment}
                  disabled={savingShipment || !newShipmentQty || !newShipmentCost || !newShipmentProductId}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded"
                >
                  {savingShipment ? 'Adding...' : 'Add Shipment'}
                </button>
              </div>
            </div>

            {/* Shipping Cost Settings */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">SHIPPING COSTS</h2>
              <div className="flex flex-wrap gap-6 items-end">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Fallback Shipping Cost (cents)</label>
                  <input
                    type="number"
                    value={fallbackShipping}
                    onChange={e => handleFallbackShippingChange(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm rounded w-40 focus:border-yellow-500 focus:outline-none"
                    placeholder="e.g. 800"
                  />
                  <span className="text-gray-500 text-xs ml-2">{formatPrice(fallbackShipping)} per order</span>
                </div>
                <div className="text-gray-400 text-sm">
                  <span className="text-white font-bold">{ordersWithShipping}</span> of <span className="text-white font-bold">{ordersTotal}</span> paid orders have actual shipping costs.
                  {ordersTotal - ordersWithShipping > 0 && (
                    <span className="text-yellow-500 ml-1">Fallback used for {ordersTotal - ordersWithShipping}.</span>
                  )}
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-3">Enter actual shipping costs per order on the Orders page, or use the bulk import below. Stripe fees (2.9% + $0.30) are calculated automatically.</p>
            </div>

            {/* Bulk Shipping Import */}
            <div className="bg-gray-800/50 border border-gray-700 mb-8">
              <button
                onClick={() => setShowCsvUpload(v => !v)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <h2 className="text-xl font-industrial text-yellow-500">BULK SHIPPING IMPORT</h2>
                <span className="text-gray-400 text-sm">{showCsvUpload ? 'Hide' : 'Show'}</span>
              </button>

              {showCsvUpload && (
                <div className="px-6 pb-6 border-t border-gray-700">
                  <p className="text-gray-400 text-sm mt-4 mb-4">
                    Upload a Pirate Ship CSV or XLSX file to batch-import shipping costs and tracking numbers.
                  </p>

                  {/* File input + Parse button */}
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        setCsvFile(e.target.files?.[0] || null)
                        setCsvResults(null)
                        setCsvApplyResults(null)
                      }}
                      className="flex-1 text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-gray-700 file:text-gray-300 file:text-sm file:cursor-pointer hover:file:bg-gray-600"
                    />
                    <button
                      onClick={handleCsvParse}
                      disabled={!csvFile || csvParsing}
                      className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {csvParsing ? 'Parsing...' : 'Parse & Preview'}
                    </button>
                  </div>

                  {/* Parse errors */}
                  {csvResults?.errors?.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 p-3 mb-4">
                      <p className="text-red-400 text-sm font-bold mb-1">Errors:</p>
                      {csvResults.errors.map((e, i) => (
                        <p key={i} className="text-red-300 text-sm">{typeof e === 'string' ? e : e.error}</p>
                      ))}
                    </div>
                  )}

                  {/* Preview table */}
                  {csvResults && csvResults.matched.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-300 text-sm font-bold">
                          Matched: {csvResults.matched.length} &nbsp;&bull;&nbsp; Unmatched: {csvResults.unmatched.length}
                        </p>
                        <div className="flex items-center gap-3 text-sm">
                          <button
                            onClick={() => setCsvCheckedRows(new Set(csvResults.matched.map(m => m.orderId)))}
                            className="text-yellow-500 hover:text-yellow-400 transition-colors"
                          >
                            All
                          </button>
                          <button
                            onClick={() => setCsvCheckedRows(new Set())}
                            className="text-gray-400 hover:text-gray-300 transition-colors"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-700">
                              <th className="pb-2 pr-3 w-8"></th>
                              <th className="pb-2 pr-3">Order</th>
                              <th className="pb-2 pr-3">Email</th>
                              <th className="pb-2 pr-3">Tracking</th>
                              <th className="pb-2 pr-3">Ship Cost</th>
                              <th className="pb-2">Match</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvResults.matched.map((item) => (
                              <tr key={item.orderId} className="border-b border-gray-800">
                                <td className="py-2 pr-3">
                                  <input
                                    type="checkbox"
                                    checked={csvCheckedRows.has(item.orderId)}
                                    onChange={(e) => {
                                      setCsvCheckedRows(prev => {
                                        const next = new Set(prev)
                                        if (e.target.checked) next.add(item.orderId)
                                        else next.delete(item.orderId)
                                        return next
                                      })
                                    }}
                                    className="accent-yellow-500"
                                  />
                                </td>
                                <td className="py-2 pr-3 text-white">{item.orderName}</td>
                                <td className="py-2 pr-3 text-gray-400 truncate max-w-[140px]">{item.orderEmail}</td>
                                <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{item.trackingNumber || '—'}</td>
                                <td className="py-2 pr-3 text-green-400">{formatPrice(item.shippingCostCents)}</td>
                                <td className="py-2 text-gray-500 text-xs">{item.matchMethod}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {csvResults.unmatched.length > 0 && (
                        <p className="text-yellow-500 text-xs mt-2">
                          {csvResults.unmatched.length} row{csvResults.unmatched.length !== 1 ? 's' : ''} could not be matched to an order.
                        </p>
                      )}

                      <button
                        onClick={handleCsvApply}
                        disabled={csvApplying || csvCheckedRows.size === 0}
                        className="mt-4 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {csvApplying ? 'Applying...' : `Apply Selected (${csvCheckedRows.size})`}
                      </button>
                    </div>
                  )}

                  {csvResults && csvResults.matched.length === 0 && !csvResults.errors?.length && (
                    <p className="text-gray-500 text-sm">No orders matched from this file.</p>
                  )}

                  {/* Apply results */}
                  {csvApplyResults && (
                    <div className="bg-gray-900 border border-gray-700 p-3 mt-2">
                      <p className="text-green-400 text-sm font-bold">
                        {csvApplyResults.updated} updated
                        {csvApplyResults.failed > 0 && (
                          <span className="text-red-400 ml-2">&bull; {csvApplyResults.failed} failed</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profit Insights */}
            {stats.paidOrdersList && stats.paidOrdersList.length > 0 && (() => {
              const allTime = calcProfitStats(stats.paidOrdersList, avgCostPerUnit, fallbackShipping)
              const last30 = calcProfitStats(stats.paidLast30 || [], avgCostPerUnit, fallbackShipping)
              return (
                <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-industrial text-yellow-500">PROFIT INSIGHTS</h2>
                    <Link to="/admin/analytics" className="text-sm text-gray-400 hover:text-yellow-500">Full analytics →</Link>
                  </div>
                  {allTime.ordersWithoutShipping > 0 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded mb-4">
                      <p className="text-yellow-500 text-sm">{allTime.ordersWithoutShipping} orders missing actual shipping cost — using {formatPrice(fallbackShipping)} fallback.</p>
                    </div>
                  )}
                  {avgCostPerUnit === 0 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded mb-4">
                      <p className="text-yellow-500 text-sm">No product shipments logged — product cost is showing as $0. Add shipments above for accurate profit.</p>
                    </div>
                  )}
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* All Time */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 mb-3">ALL TIME</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Gross Revenue</span>
                          <span className="text-white font-bold">{formatPrice(allTime.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Product Cost ({formatPrice(avgCostPerUnit)}/unit)</span>
                          <span className="text-red-400">-{formatPrice(allTime.totalProductCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Shipping Cost</span>
                          <span className="text-red-400">-{formatPrice(allTime.totalShippingCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Stripe Fees</span>
                          <span className="text-red-400">-{formatPrice(allTime.totalStripeFees)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-700">
                          <span className="text-white font-bold">Net Profit</span>
                          <span className={`font-bold ${allTime.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPrice(allTime.netProfit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Margin</span>
                          <span className={`font-bold ${allTime.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {allTime.margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Last 30 Days */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 mb-3">LAST 30 DAYS</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Gross Revenue</span>
                          <span className="text-white font-bold">{formatPrice(last30.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Product Cost</span>
                          <span className="text-red-400">-{formatPrice(last30.totalProductCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Shipping Cost</span>
                          <span className="text-red-400">-{formatPrice(last30.totalShippingCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Stripe Fees</span>
                          <span className="text-red-400">-{formatPrice(last30.totalStripeFees)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-700">
                          <span className="text-white font-bold">Net Profit</span>
                          <span className={`font-bold ${last30.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPrice(last30.netProfit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Margin</span>
                          <span className={`font-bold ${last30.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {last30.margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Recent Orders */}
            {stats.recentOrders.length > 0 && (
              <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-industrial text-yellow-500">RECENT ORDERS</h2>
                  <Link to="/admin/orders" className="text-sm text-gray-400 hover:text-yellow-500">View all →</Link>
                </div>
                <div className="space-y-3">
                  {stats.recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                      <div>
                        <span className="text-white font-bold">{order.name}</span>
                        <span className="text-gray-400 text-sm ml-3">
                          {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' :
                          order.payment_status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {order.payment_status === 'paid' ? 'PAID' : order.payment_status === 'failed' ? 'FAILED' : 'UNPAID'}
                        </span>
                        <span className="text-yellow-500 font-bold">{formatPrice(order.total_cents)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Testimonials */}
            {stats.recentTestimonials.length > 0 && (
              <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-industrial text-yellow-500">RECENT TESTIMONIALS</h2>
                  <Link to="/admin/testimonials" className="text-sm text-gray-400 hover:text-yellow-500">View all →</Link>
                </div>
                <div className="space-y-3">
                  {stats.recentTestimonials.map((t) => (
                    <div key={t.id} className="p-3 bg-gray-800 rounded">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <span className="text-white font-bold text-sm">{t.display_name || t.customer_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          t.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          t.status === 'archived' ? 'bg-gray-700/40 text-gray-500' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm italic">
                        "{(t.testimonial_text || '').slice(0, 160)}{(t.testimonial_text || '').length > 160 ? '…' : ''}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <h2 className="text-xl font-industrial text-yellow-500 mb-4">QUICK ACTIONS</h2>
                <div className="space-y-3">
                  <button
                    onClick={handleSendTestimonialRequests}
                    disabled={sendingTestimonials || stats.pendingTestimonialCount === 0}
                    className="w-full flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <span className="text-white">
                      {sendingTestimonials
                        ? 'Sending testimonial requests…'
                        : stats.pendingTestimonialCount > 0
                          ? `Send testimonial requests (${stats.pendingTestimonialCount} pending)`
                          : 'No testimonial requests pending'}
                    </span>
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {sendResult && (
                    <p className={`text-xs ${sendResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {sendResult.message}
                    </p>
                  )}
                  <Link to="/admin/quotes" className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 transition-colors rounded">
                    <span className="text-white">Review Quote Requests</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link to="/admin/orders" className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 transition-colors rounded">
                    <span className="text-white">View Orders</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link to="/admin/email" className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 transition-colors rounded">
                    <span className="text-white">Send Email Blast</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link to="/admin/analytics" className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 transition-colors rounded">
                    <span className="text-white">View Analytics</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link to="/admin/newsletter" className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 transition-colors rounded">
                    <span className="text-white">Manage Newsletter</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link to="/" target="_blank" className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 transition-colors rounded">
                    <span className="text-white">View Live Website</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <h2 className="text-xl font-industrial text-yellow-500 mb-4">SETUP REQUIRED</h2>
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded">
                    <div className="flex items-center gap-2 text-yellow-500 mb-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-bold">Stripe Integration</span>
                    </div>
                    <p className="text-gray-400 text-sm">Configure Stripe to enable payment processing.</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/50 rounded">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-bold">Database Tables</span>
                    </div>
                    <p className="text-gray-400 text-sm">Run the SQL schema to create products and orders tables.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboardPage
