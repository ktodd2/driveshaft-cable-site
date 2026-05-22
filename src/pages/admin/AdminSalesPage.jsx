import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCartStore } from '../../stores/cartStore'
import { useSales } from '../../hooks/useSales'
import { useProducts } from '../../hooks/useProducts'

// Format a Date object as the local-time string a <input type="datetime-local">
// expects: 'YYYY-MM-DDTHH:MM'.
function toLocalDatetime(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyForm() {
  const now = new Date()
  const inDay = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return {
    name: '',
    discountPercent: '10',
    scope: 'sitewide',
    productId: '',
    startsAt: toLocalDatetime(now),
    endsAt: toLocalDatetime(inDay),
  }
}

function rowToForm(s) {
  return {
    name: s.name,
    discountPercent: String(s.discount_percent),
    scope: s.scope,
    productId: s.product_id || '',
    startsAt: toLocalDatetime(new Date(s.starts_at)),
    endsAt: toLocalDatetime(new Date(s.ends_at)),
  }
}

function statusOf(sale, now = Date.now()) {
  if (!sale.is_active) return 'Paused'
  const start = new Date(sale.starts_at).getTime()
  const end   = new Date(sale.ends_at).getTime()
  if (now < start) return 'Scheduled'
  if (now >= end)  return 'Ended'
  return 'Live'
}

function statusBadge(status) {
  switch (status) {
    case 'Live':      return 'bg-green-500/20 text-green-400'
    case 'Scheduled': return 'bg-blue-500/20 text-blue-400'
    case 'Ended':     return 'bg-gray-600/30 text-gray-400'
    case 'Paused':    return 'bg-yellow-500/20 text-yellow-400'
    default:          return 'bg-gray-600/30 text-gray-400'
  }
}

function AdminSalesPage() {
  const navigate = useNavigate()
  const [authChecked, setAuthChecked] = useState(false)
  const { sales, loading, addSale, updateSale, deleteSale } = useSales()
  const { activeProducts } = useProducts()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [savedMsg, setSavedMsg] = useState(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) navigate('/admin/login')
      else setAuthChecked(true)
    })()
  }, [navigate])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const startAdd = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
    setShowModal(true)
  }

  const startEdit = (sale) => {
    setEditingId(sale.id)
    setForm(rowToForm(sale))
    setError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setError(null)
  }

  // Quick-set the end time to N minutes/hours/days from the current starts_at.
  const setEndOffset = (minutes) => {
    const start = new Date(form.startsAt)
    if (isNaN(start.getTime())) return
    const end = new Date(start.getTime() + minutes * 60 * 1000)
    setForm({ ...form, endsAt: toLocalDatetime(end) })
  }

  const validate = () => {
    if (!form.name.trim()) return 'Name is required.'
    const pct = parseInt(form.discountPercent, 10)
    if (isNaN(pct) || pct < 1 || pct > 99) return 'Discount must be between 1 and 99.'
    if (!['sitewide', 'product'].includes(form.scope)) return 'Pick a scope.'
    if (form.scope === 'product' && !form.productId) return 'Pick a product for product-scoped sales.'
    const s = new Date(form.startsAt).getTime()
    const e = new Date(form.endsAt).getTime()
    if (isNaN(s) || isNaN(e)) return 'Start and end times are required.'
    if (e <= s) return 'End must be after start.'
    return null
  }

  const handleSave = async () => {
    setError(null)
    const v = validate()
    if (v) return setError(v)
    setBusy(true)
    const payload = {
      name: form.name.trim(),
      discountPercent: parseInt(form.discountPercent, 10),
      scope: form.scope,
      productId: form.scope === 'product' ? form.productId : null,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt:   new Date(form.endsAt).toISOString(),
    }
    const result = editingId
      ? await updateSale(editingId, payload)
      : await addSale(payload)
    setBusy(false)
    if (result.error) {
      setError(result.error.message || 'Save failed.')
      return
    }
    await useCartStore.getState().loadSales()
    closeModal()
    setSavedMsg(editingId ? 'Sale updated' : 'Sale created')
    setTimeout(() => setSavedMsg(null), 2500)
  }

  const handleToggleActive = async (sale) => {
    setBusy(true)
    await updateSale(sale.id, { isActive: !sale.is_active })
    await useCartStore.getState().loadSales()
    setBusy(false)
  }

  const handleEndNow = async (sale) => {
    setBusy(true)
    await updateSale(sale.id, { endsAt: new Date().toISOString() })
    await useCartStore.getState().loadSales()
    setBusy(false)
    setSavedMsg('Sale ended')
    setTimeout(() => setSavedMsg(null), 2500)
  }

  const handleDelete = async (id) => {
    setBusy(true)
    await deleteSale(id)
    await useCartStore.getState().loadSales()
    setBusy(false)
    setConfirmDelete(null)
  }

  const productById = useMemo(() => {
    const map = {}
    for (const p of activeProducts) map[p.id] = p
    return map
  }, [activeProducts])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-ktodd-dark flex items-center justify-center">
        <div className="text-yellow-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ktodd-dark">
      <header className="bg-ktodd-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="flex items-center gap-2">
                <img src="/logos/icon.png" alt="Driveshaft Cable" className="w-8 h-8 rounded" />
                <span className="text-yellow-500 font-industrial">ADMIN</span>
              </Link>
              <span className="text-gray-600">/</span>
              <span className="text-white font-industrial">SALES</span>
            </div>
            <button onClick={handleSignOut} className="text-gray-400 hover:text-red-500 transition-colors text-sm">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-industrial text-white">SALES</h1>
            <p className="text-gray-400 text-sm mt-1">
              Create time-limited % off promotions — site-wide or per product. Storefront shows slashed prices + a countdown.
            </p>
          </div>
          <button
            onClick={startAdd}
            className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 font-bold text-sm rounded transition-colors"
          >
            + Add Sale
          </button>
        </div>

        {savedMsg && (
          <div className="bg-green-500/10 border border-green-500/40 px-4 py-2 mb-4 rounded text-green-400 text-sm">
            {savedMsg}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 py-12 text-center">Loading sales...</div>
        ) : sales.length === 0 ? (
          <div className="text-gray-500 py-12 text-center border border-dashed border-gray-700 rounded">
            No sales yet. Click "Add Sale" to create one.
          </div>
        ) : (
          <div className="bg-gray-800/30 border border-gray-700 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                  <th className="text-left  py-3 px-4">Name</th>
                  <th className="text-left  py-3 px-4">Scope</th>
                  <th className="text-right py-3 px-4">% Off</th>
                  <th className="text-left  py-3 px-4">Starts</th>
                  <th className="text-left  py-3 px-4">Ends</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Active</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => {
                  const status = statusOf(s)
                  const scopeLabel = s.scope === 'sitewide'
                    ? 'Site-wide'
                    : (productById[s.product_id]?.name || `Product ${s.product_id}`)
                  return (
                    <tr key={s.id} className="border-b border-gray-700/50">
                      <td className="py-3 px-4 text-white font-bold">{s.name}</td>
                      <td className="py-3 px-4 text-gray-300">{scopeLabel}</td>
                      <td className="py-3 px-4 text-right text-yellow-500 font-bold">{s.discount_percent}%</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{new Date(s.starts_at).toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{new Date(s.ends_at).toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded ${statusBadge(status)}`}>{status}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(s)}
                          disabled={busy}
                          className={`text-xs px-2 py-1 rounded ${s.is_active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-600/30 text-gray-400 hover:bg-gray-600/50'}`}
                        >
                          {s.is_active ? 'On' : 'Off'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => startEdit(s)}
                          className="text-yellow-500 hover:text-yellow-400 text-xs mr-3"
                        >
                          Edit
                        </button>
                        {status === 'Live' && (
                          <button
                            onClick={() => handleEndNow(s)}
                            disabled={busy}
                            className="text-orange-400 hover:text-orange-300 text-xs mr-3"
                          >
                            End now
                          </button>
                        )}
                        {confirmDelete === s.id ? (
                          <>
                            <button onClick={() => handleDelete(s.id)} disabled={busy} className="text-red-400 hover:text-red-300 text-xs mr-2">Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-gray-500 hover:text-gray-400 text-xs">Cancel</button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(s.id)}
                            disabled={busy}
                            className="text-red-500 hover:text-red-400 text-xs"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded max-w-lg w-full p-6">
            <h2 className="text-xl font-industrial text-yellow-500 mb-4">
              {editingId ? 'EDIT SALE' : 'ADD SALE'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Memorial Day Flash"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Discount % *</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={form.discountPercent}
                    onChange={e => setForm({ ...form, discountPercent: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Scope *</label>
                  <select
                    value={form.scope}
                    onChange={e => setForm({ ...form, scope: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="sitewide">Site-wide</option>
                    <option value="product">Specific product</option>
                  </select>
                </div>
              </div>

              {form.scope === 'product' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Product *</label>
                  <select
                    value={form.productId}
                    onChange={e => setForm({ ...form, productId: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="">— Select product —</option>
                    {activeProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Starts *</label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={e => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Ends *</label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={e => setForm({ ...form, endsAt: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-gray-500 text-xs self-center mr-1">Quick-set end:</span>
                {[
                  { label: '1h',  m: 60 },
                  { label: '12h', m: 60 * 12 },
                  { label: '24h', m: 60 * 24 },
                  { label: '3d',  m: 60 * 24 * 3 },
                  { label: '1w',  m: 60 * 24 * 7 },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setEndOffset(p.m)}
                    className="text-xs px-2 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/40 px-3 py-2 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeModal} disabled={busy} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black px-4 py-2 font-bold text-sm rounded transition-colors"
              >
                {busy ? 'Saving...' : (editingId ? 'Save changes' : 'Create sale')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSalesPage
