import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, useCartStore } from '../../stores/cartStore'
import { useProducts } from '../../hooks/useProducts'

// Convert a dollar-string input ("3.45") to integer cents (345). Returns null
// if blank/invalid so the caller can validate.
function dollarsToCents(s) {
  if (s === '' || s == null) return null
  const n = parseFloat(s)
  if (isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

function emptyForm() {
  return {
    id: '',
    name: '',
    sku: '',
    basePrice: '',
    tier50: '',
    tier100: '',
    tier200: '',
    isStorefront: false,
  }
}

function rowToForm(p) {
  // Tier prices are stored as JSONB [{ min, price }, ...]. Pull the prices
  // for the three canonical tiers (50/100/200); missing tiers stay blank.
  const byMin = {}
  for (const t of (p.tiers || [])) byMin[t.min] = t.price
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    basePrice: (p.base_price_cents / 100).toFixed(2),
    tier50: byMin[50] != null ? (byMin[50] / 100).toFixed(2) : '',
    tier100: byMin[100] != null ? (byMin[100] / 100).toFixed(2) : '',
    tier200: byMin[200] != null ? (byMin[200] / 100).toFixed(2) : '',
    isStorefront: !!p.is_storefront,
  }
}

function AdminProductsPage() {
  const navigate = useNavigate()
  const [authChecked, setAuthChecked] = useState(false)
  const { products, loading, addProduct, updateProduct, deleteProduct, refetch } = useProducts()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState(null) // product.id being edited
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
    setShowAddModal(true)
  }

  const startEdit = (product) => {
    setEditingId(product.id)
    setForm(rowToForm(product))
    setError(null)
    setShowAddModal(true)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

  const validate = () => {
    if (!editingId && !/^[a-z0-9-]+$/.test(form.id)) {
      return 'Product ID must be lowercase letters, numbers, and hyphens only.'
    }
    if (!form.name.trim()) return 'Name is required.'
    if (!form.sku.trim()) return 'SKU is required.'
    const baseCents = dollarsToCents(form.basePrice)
    if (baseCents == null) return 'Base price must be a positive number.'
    const tierCents = [form.tier50, form.tier100, form.tier200].map(dollarsToCents)
    if (tierCents.some(c => c == null)) return 'All three tier prices must be filled.'
    // Sanity: tier prices should be <= base price and descending as min increases.
    if (tierCents[0] > baseCents) return 'Tier 50+ price should be lower than base price.'
    if (tierCents[1] > tierCents[0]) return 'Tier 100+ should be <= Tier 50+.'
    if (tierCents[2] > tierCents[1]) return 'Tier 200+ should be <= Tier 100+.'
    return null
  }

  const handleSave = async () => {
    setError(null)
    const v = validate()
    if (v) return setError(v)
    setBusy(true)
    const baseCents = dollarsToCents(form.basePrice)
    const tiers = [
      { min: 50,  price: dollarsToCents(form.tier50) },
      { min: 100, price: dollarsToCents(form.tier100) },
      { min: 200, price: dollarsToCents(form.tier200) },
    ]
    let result
    if (editingId) {
      result = await updateProduct(editingId, {
        name: form.name.trim(),
        sku: form.sku.trim(),
        basePriceCents: baseCents,
        tiers,
        isStorefront: form.isStorefront,
      })
    } else {
      result = await addProduct({
        id: form.id.trim(),
        name: form.name.trim(),
        sku: form.sku.trim(),
        basePriceCents: baseCents,
        tiers,
        isStorefront: form.isStorefront,
        sortOrder: products.length + 1,
      })
    }
    setBusy(false)
    if (result.error) {
      setError(result.error.message || 'Save failed.')
      return
    }
    // Push the new pricing into the in-memory cart store so storefront pages
    // see the change without a reload.
    await useCartStore.getState().loadProducts()
    closeModal()
    setSavedMsg(editingId ? 'Product updated' : 'Product added')
    setTimeout(() => setSavedMsg(null), 2500)
  }

  const handleDelete = async (id) => {
    setBusy(true)
    const { error: delError } = await deleteProduct(id)
    setBusy(false)
    setConfirmDelete(null)
    if (delError) {
      setError(`Delete failed: ${delError.message}. Products referenced by shipments cannot be removed — set them inactive instead.`)
      return
    }
    await useCartStore.getState().loadProducts()
    setSavedMsg('Product deleted')
    setTimeout(() => setSavedMsg(null), 2500)
  }

  const handleToggleActive = async (product) => {
    setBusy(true)
    await updateProduct(product.id, { isActive: !product.is_active })
    setBusy(false)
    await useCartStore.getState().loadProducts()
  }

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
              <span className="text-white font-industrial">PRODUCTS</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-industrial text-white">PRODUCTS</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage the catalog: edit prices/names/SKU or add new product slots.
            </p>
          </div>
          <button
            onClick={startAdd}
            className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 font-bold text-sm rounded transition-colors"
          >
            + Add Product
          </button>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/40 px-4 py-3 mb-6 rounded text-sm">
          <p className="text-blue-300">
            <span className="font-bold">Heads up:</span> New products added here show up in admin inventory,
            shipments, analytics, and manual-order entry. They <em>do not</em> auto-list on the
            public storefront — wiring a new product onto <code className="text-blue-200">/products</code> still
            requires a code update. Editing prices or names for existing storefront products DOES flow through to the public site.
          </p>
        </div>

        {savedMsg && (
          <div className="bg-green-500/10 border border-green-500/40 px-4 py-2 mb-4 rounded text-green-400 text-sm">
            {savedMsg}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 py-12 text-center">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-gray-500 py-12 text-center border border-dashed border-gray-700 rounded">
            No products yet. Click "Add Product" to create one.
          </div>
        ) : (
          <div className="bg-gray-800/30 border border-gray-700 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                  <th className="text-left py-3 px-4">ID</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">SKU</th>
                  <th className="text-right py-3 px-4">Base</th>
                  <th className="text-right py-3 px-4">50+</th>
                  <th className="text-right py-3 px-4">100+</th>
                  <th className="text-right py-3 px-4">200+</th>
                  <th className="text-center py-3 px-4">Storefront</th>
                  <th className="text-center py-3 px-4">Active</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const tierByMin = Object.fromEntries((p.tiers || []).map(t => [t.min, t.price]))
                  return (
                    <tr key={p.id} className={`border-b border-gray-700/50 ${!p.is_active ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-4 text-gray-300 font-mono text-xs">{p.id}</td>
                      <td className="py-3 px-4 text-white font-bold">{p.name}</td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-xs">{p.sku}</td>
                      <td className="py-3 px-4 text-right text-white">{formatPrice(p.base_price_cents)}</td>
                      <td className="py-3 px-4 text-right text-gray-300">{tierByMin[50] != null ? formatPrice(tierByMin[50]) : '—'}</td>
                      <td className="py-3 px-4 text-right text-gray-300">{tierByMin[100] != null ? formatPrice(tierByMin[100]) : '—'}</td>
                      <td className="py-3 px-4 text-right text-gray-300">{tierByMin[200] != null ? formatPrice(tierByMin[200]) : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        {p.is_storefront ? (
                          <span className="text-green-400 text-xs">Yes</span>
                        ) : (
                          <span className="text-gray-500 text-xs">Admin only</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          disabled={busy}
                          className={`text-xs px-2 py-1 rounded ${p.is_active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-600/30 text-gray-400 hover:bg-gray-600/50'}`}
                        >
                          {p.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => startEdit(p)}
                          className="text-yellow-500 hover:text-yellow-400 text-xs mr-3"
                        >
                          Edit
                        </button>
                        {confirmDelete === p.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(p.id)}
                              disabled={busy}
                              className="text-red-400 hover:text-red-300 text-xs mr-2"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-gray-500 hover:text-gray-400 text-xs"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(p.id)}
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

        {error && !showAddModal && (
          <div className="bg-red-500/10 border border-red-500/40 px-4 py-3 mt-4 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded max-w-lg w-full p-6">
            <h2 className="text-xl font-industrial text-yellow-500 mb-4">
              {editingId ? `EDIT PRODUCT ${editingId}` : 'ADD PRODUCT'}
            </h2>

            <div className="space-y-3">
              {!editingId && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Product ID <span className="text-gray-500">(lowercase, used as the key)</span>
                  </label>
                  <input
                    type="text"
                    value={form.id}
                    onChange={e => setForm({ ...form, id: e.target.value })}
                    placeholder="e.g. 3 or driveshaft-cable-xl"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-400 text-sm mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">SKU *</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value })}
                  placeholder="KTDC-XXX"
                  className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Base price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.basePrice}
                    onChange={e => setForm({ ...form, basePrice: e.target.value })}
                    placeholder="3.45"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tier 50+ ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.tier50}
                    onChange={e => setForm({ ...form, tier50: e.target.value })}
                    placeholder="3.35"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tier 100+ ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.tier100}
                    onChange={e => setForm({ ...form, tier100: e.target.value })}
                    placeholder="3.15"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tier 200+ ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.tier200}
                    onChange={e => setForm({ ...form, tier200: e.target.value })}
                    placeholder="2.90"
                    className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isStorefront}
                  onChange={e => setForm({ ...form, isStorefront: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Shown on public storefront</span>
                <span className="text-gray-500 text-xs">(toggle only flags it — actual listing still requires code)</span>
              </label>
            </div>

            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/40 px-3 py-2 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                disabled={busy}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black px-4 py-2 font-bold text-sm rounded transition-colors"
              >
                {busy ? 'Saving...' : (editingId ? 'Save changes' : 'Add product')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminProductsPage
