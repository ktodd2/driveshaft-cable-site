import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getAllProductsAdmin, getInventoryLog, addInventory, setInventory } from '../../lib/inventory'
import { formatPrice } from '../../stores/cartStore'
import { format } from 'date-fns'

function AdminInventoryPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [inventoryLog, setInventoryLog] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState('add') // 'add' or 'set'
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjustmentNotes, setAdjustmentNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkAuth()
    loadData()
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

  const loadData = async () => {
    try {
      const [productsData, logData] = await Promise.all([
        getAllProductsAdmin(),
        getInventoryLog(null, 50)
      ])
      setProducts(productsData)
      setInventoryLog(logData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load inventory data')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const openAdjustModal = (product, type) => {
    setSelectedProduct(product)
    setAdjustmentType(type)
    setAdjustmentQuantity('')
    setAdjustmentReason('')
    setAdjustmentNotes('')
    setError(null)
    setShowAdjustModal(true)
  }

  const handleAdjustInventory = async (e) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)

    try {
      const quantity = parseInt(adjustmentQuantity)
      if (isNaN(quantity) || quantity < 0) {
        throw new Error('Please enter a valid quantity')
      }

      if (adjustmentType === 'add') {
        await addInventory(
          selectedProduct.id,
          quantity,
          adjustmentReason || 'manual_adjustment',
          adjustmentNotes,
          user.id
        )
      } else {
        await setInventory(
          selectedProduct.id,
          quantity,
          adjustmentReason || 'manual_adjustment',
          adjustmentNotes,
          user.id
        )
      }

      // Reload data
      await loadData()
      setShowAdjustModal(false)
      setSelectedProduct(null)
    } catch (err) {
      console.error('Error adjusting inventory:', err)
      setError(err.message || 'Failed to adjust inventory')
    } finally {
      setProcessing(false)
    }
  }

  const getStockStatusColor = (product) => {
    if (product.stock_quantity === 0) return 'text-red-500'
    if (product.stock_quantity <= product.low_stock_threshold) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getStockStatusBadge = (product) => {
    if (product.stock_quantity === 0) {
      return <span className="bg-red-500/20 text-red-400 px-2 py-1 text-xs rounded">OUT OF STOCK</span>
    }
    if (product.stock_quantity <= product.low_stock_threshold) {
      return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 text-xs rounded">LOW STOCK</span>
    }
    return <span className="bg-green-500/20 text-green-400 px-2 py-1 text-xs rounded">IN STOCK</span>
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
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
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
            </Link>
            <Link to="/admin/inventory" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Inventory
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
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-industrial text-white">
                INVENTORY MANAGEMENT
              </h1>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 mb-6 rounded">
                {error}
              </div>
            )}

            {/* Products Table */}
            <div className="bg-gray-800/50 border border-gray-700 mb-8">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-industrial text-yellow-500">PRODUCTS</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-800/50">
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">{product.name}</div>
                          <div className="text-gray-400 text-sm">Threshold: {product.low_stock_threshold}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-300">{product.sku}</td>
                        <td className="px-6 py-4">
                          <span className={`text-2xl font-industrial ${getStockStatusColor(product)}`}>
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getStockStatusBadge(product)}
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {formatPrice(product.price_cents)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openAdjustModal(product, 'add')}
                              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1 text-sm rounded transition-colors"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => openAdjustModal(product, 'set')}
                              className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 px-3 py-1 text-sm rounded transition-colors"
                            >
                              Set
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Log */}
            <div className="bg-gray-800/50 border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-industrial text-yellow-500">INVENTORY HISTORY</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Change</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {inventoryLog.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-800/50">
                        <td className="px-6 py-4 text-gray-300 text-sm">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{log.product?.name}</div>
                          <div className="text-gray-400 text-xs">{log.product?.sku}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${log.change_quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {log.change_quantity > 0 ? '+' : ''}{log.change_quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300 text-sm">{log.reason}</td>
                        <td className="px-6 py-4 text-gray-400 text-sm">{log.notes || '-'}</td>
                        <td className="px-6 py-4 text-gray-300 text-sm">
                          {log.admin_user?.name || log.admin_user?.email || 'System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 max-w-md w-full p-6">
            <h3 className="text-2xl font-industrial text-yellow-500 mb-4">
              {adjustmentType === 'add' ? 'ADD' : 'SET'} INVENTORY
            </h3>
            <div className="mb-4">
              <div className="text-white font-bold">{selectedProduct.name}</div>
              <div className="text-gray-400 text-sm">Current Stock: {selectedProduct.stock_quantity} units</div>
            </div>

            <form onSubmit={handleAdjustInventory}>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">
                  {adjustmentType === 'add' ? 'Quantity to Add' : 'New Stock Quantity'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  placeholder="Enter quantity"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Reason</label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                >
                  <option value="manual_adjustment">Manual Adjustment</option>
                  <option value="stock_received">Stock Received</option>
                  <option value="damaged">Damaged/Lost</option>
                  <option value="correction">Inventory Correction</option>
                  <option value="return">Customer Return</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-gray-400 text-sm mb-2">Notes (optional)</label>
                <textarea
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  rows="3"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  placeholder="Add any additional notes..."
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  disabled={processing}
                  className="flex-1 border-2 border-gray-600 text-gray-300 hover:bg-gray-800 font-bold py-3 px-6 uppercase tracking-wider transition-all duration-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminInventoryPage
