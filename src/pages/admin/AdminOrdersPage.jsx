import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../stores/cartStore'

function AdminOrdersPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingCarrier, setTrackingCarrier] = useState('ups')
  const [savingTracking, setSavingTracking] = useState(false)

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
                <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
                  <span className="text-black font-bold text-sm font-industrial">K</span>
                </div>
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
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <h1 className="text-3xl font-industrial text-white">ORDERS</h1>

              {/* Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-sm">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm rounded"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <span className="text-gray-400 text-sm">Payment:</span>
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
                        <span className={`px-2 py-1 text-xs border rounded ${getStatusColor(order.status)}`}>
                          {order.status?.toUpperCase()}
                        </span>
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
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-700 mt-2">
                          <span className="text-gray-400">Shipping</span>
                          <span className="text-green-400">FREE</span>
                        </div>
                        <div className="flex justify-between font-bold pt-2">
                          <span className="text-white">Total</span>
                          <span className="text-yellow-500">{formatPrice(selectedOrder.total_cents)}</span>
                        </div>
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
                            <div className="flex gap-2">
                              <select
                                value={trackingCarrier}
                                onChange={(e) => setTrackingCarrier(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm rounded"
                              >
                                <option value="ups">UPS</option>
                                <option value="usps">USPS</option>
                              </select>
                              <input
                                type="text"
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                placeholder="Enter tracking number"
                                className="flex-1 bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                              />
                            </div>
                            <button
                              onClick={() => saveTracking(selectedOrder.id)}
                              disabled={!trackingNumber.trim() || savingTracking}
                              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingTracking ? 'Saving...' : 'Save & Mark Shipped'}
                            </button>
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
    </div>
  )
}

export default AdminOrdersPage
