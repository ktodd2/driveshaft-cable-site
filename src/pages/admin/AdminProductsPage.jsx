import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice, useCartStore } from '../../stores/cartStore'
import { useProducts } from '../../hooks/useProducts'
import { invalidateStorefrontProductsCache } from '../../hooks/useStorefrontProducts'
import ImageUploader from '../../components/admin/ImageUploader'

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
    minOrderQuantity: '10',
    orderQuantityStep: '10',
    isStorefront: false,
    sortOrder: 0,
    // Phase 2: storefront content
    slug: '',
    shortDescription: '',
    description: '',
    specs: [],            // [{ key, value }, ...]
    applications: [],     // [string, ...]
    features: [],         // [{ title, description }, ...]
    images: [],           // [url, ...]
    tagline: '',
    showcaseBullets: ['', '', ''],
    ctaLabel: '',
  }
}

// Convert a saved product row into the form shape used by the modal.
function rowToForm(p) {
  const byMin = {}
  for (const t of (p.tiers || [])) byMin[t.min] = t.price
  // Specs JSONB is an object {label: value}; form uses an array of rows
  // so we can preserve order and allow blank rows during editing.
  const specsArr = Object.entries(p.specs || {}).map(([key, value]) => ({ key, value }))
  const bullets = Array.isArray(p.showcase_bullets) ? p.showcase_bullets : []
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    basePrice: (p.base_price_cents / 100).toFixed(2),
    tier50:  byMin[50]  != null ? (byMin[50]  / 100).toFixed(2) : '',
    tier100: byMin[100] != null ? (byMin[100] / 100).toFixed(2) : '',
    tier200: byMin[200] != null ? (byMin[200] / 100).toFixed(2) : '',
    minOrderQuantity: String(p.min_order_quantity ?? 10),
    orderQuantityStep: String(p.order_quantity_step ?? 10),
    isStorefront: !!p.is_storefront,
    sortOrder: p.sort_order ?? 0,
    slug: p.slug || '',
    shortDescription: p.short_description || '',
    description: p.description || '',
    specs: specsArr,
    applications: Array.isArray(p.applications) ? [...p.applications] : [],
    features: Array.isArray(p.features) ? p.features.map(f => ({ ...f })) : [],
    images: Array.isArray(p.images) ? [...p.images] : [],
    tagline: p.tagline || '',
    showcaseBullets: [
      bullets[0] || '',
      bullets[1] || '',
      bullets[2] || '',
    ],
    ctaLabel: p.cta_label || '',
  }
}

const TABS = [
  { key: 'basics',     label: 'Basics' },
  { key: 'pricing',    label: 'Pricing' },
  { key: 'storefront', label: 'Storefront' },
  { key: 'specs',      label: 'Specs' },
  { key: 'applications', label: 'Applications' },
  { key: 'features',   label: 'Features' },
  { key: 'images',     label: 'Images' },
]

function AdminProductsPage() {
  const navigate = useNavigate()
  const [authChecked, setAuthChecked] = useState(false)
  const { products, loading, addProduct, updateProduct, deleteProduct } = useProducts()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [activeTab, setActiveTab] = useState('basics')
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
    setActiveTab('basics')
    setError(null)
    setShowAddModal(true)
  }

  const startEdit = (product) => {
    setEditingId(product.id)
    setForm(rowToForm(product))
    setActiveTab('basics')
    setError(null)
    setShowAddModal(true)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingId(null)
    setForm(emptyForm())
    setActiveTab('basics')
    setError(null)
  }

  const setField = (patch) => setForm(prev => ({ ...prev, ...patch }))

  // ---- Repeating-row editors (specs / applications / features) ----------
  const updateSpec = (idx, patch) => {
    const next = form.specs.map((row, i) => i === idx ? { ...row, ...patch } : row)
    setField({ specs: next })
  }
  const addSpec = () => setField({ specs: [...form.specs, { key: '', value: '' }] })
  const removeSpec = (idx) => setField({ specs: form.specs.filter((_, i) => i !== idx) })

  const updateApp = (idx, value) => {
    const next = [...form.applications]
    next[idx] = value
    setField({ applications: next })
  }
  const addApp = () => setField({ applications: [...form.applications, ''] })
  const removeApp = (idx) => setField({ applications: form.applications.filter((_, i) => i !== idx) })

  const updateFeature = (idx, patch) => {
    const next = form.features.map((row, i) => i === idx ? { ...row, ...patch } : row)
    setField({ features: next })
  }
  const addFeature = () => setField({ features: [...form.features, { title: '', description: '' }] })
  const removeFeature = (idx) => setField({ features: form.features.filter((_, i) => i !== idx) })

  // ---- Validation --------------------------------------------------------
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
    if (tierCents[0] > baseCents) return 'Tier 50+ price should be lower than base price.'
    if (tierCents[1] > tierCents[0]) return 'Tier 100+ should be <= Tier 50+.'
    if (tierCents[2] > tierCents[1]) return 'Tier 200+ should be <= Tier 100+.'
    if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) {
      return 'Slug must be lowercase letters, numbers, and hyphens only.'
    }
    if (form.isStorefront) {
      if (!form.slug.trim()) return 'Storefront-visible products need a slug.'
      if (form.images.length === 0) return 'Storefront-visible products need at least one image.'
    }
    return null
  }

  // ---- Save --------------------------------------------------------------
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
    // Strip blank rows from repeating editors before persisting.
    const specsObj = {}
    for (const row of form.specs) {
      const k = row.key?.trim()
      const v = row.value?.trim()
      if (k && v) specsObj[k] = v
    }
    const applications = form.applications.map(s => s.trim()).filter(Boolean)
    const features = form.features
      .map(f => ({ title: (f.title || '').trim(), description: (f.description || '').trim() }))
      .filter(f => f.title && f.description)
    const bullets = form.showcaseBullets.map(s => (s || '').trim()).filter(Boolean)

    // Order-rule fields. Both default to 10 when blank/invalid so the form
    // never persists a 0 (which would break the cart math).
    const minOrderQuantity = Math.max(1, parseInt(form.minOrderQuantity, 10) || 10)
    const orderQuantityStep = Math.max(1, parseInt(form.orderQuantityStep, 10) || 10)

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      basePriceCents: baseCents,
      tiers,
      minOrderQuantity,
      orderQuantityStep,
      isStorefront: form.isStorefront,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
      slug: form.slug.trim() || null,
      shortDescription: form.shortDescription.trim() || null,
      description: form.description.trim() || null,
      specs: specsObj,
      applications,
      features,
      images: form.images,
      tagline: form.tagline.trim() || null,
      showcaseBullets: bullets,
      ctaLabel: form.ctaLabel.trim() || null,
    }

    let result
    if (editingId) {
      result = await updateProduct(editingId, payload)
    } else {
      result = await addProduct({ id: form.id.trim(), ...payload })
    }
    setBusy(false)
    if (result.error) {
      setError(result.error.message || 'Save failed.')
      return
    }

    // Refresh both cart-side pricing and the storefront content cache.
    await useCartStore.getState().loadProducts()
    invalidateStorefrontProductsCache()
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
      setError(`Delete failed: ${delError.message}. Products referenced by orders/shipments cannot be removed — set them inactive instead.`)
      return
    }
    await useCartStore.getState().loadProducts()
    invalidateStorefrontProductsCache()
    setSavedMsg('Product deleted')
    setTimeout(() => setSavedMsg(null), 2500)
  }

  const handleToggleActive = async (product) => {
    setBusy(true)
    await updateProduct(product.id, { isActive: !product.is_active })
    setBusy(false)
    await useCartStore.getState().loadProducts()
    invalidateStorefrontProductsCache()
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
            <button onClick={handleSignOut} className="text-gray-400 hover:text-red-500 transition-colors text-sm">
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
              Manage every per-product field — pricing, descriptions, specs, applications, features, photos, and homepage card copy.
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
            <span className="font-bold">Tip:</span> Toggle <em>Storefront visible</em> in Basics to make a product appear on
            <code className="text-blue-200 mx-1">/products</code> and the homepage. Storefront-visible products need a slug AND at least one image.
            Edits flow through to the live site as soon as you save.
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
                  <th className="text-left  py-3 px-4">ID</th>
                  <th className="text-left  py-3 px-4">Name</th>
                  <th className="text-left  py-3 px-4">SKU</th>
                  <th className="text-left  py-3 px-4">Slug</th>
                  <th className="text-right py-3 px-4">Base</th>
                  <th className="text-center py-3 px-4">Images</th>
                  <th className="text-center py-3 px-4">Storefront</th>
                  <th className="text-center py-3 px-4">Active</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className={`border-b border-gray-700/50 ${!p.is_active ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{p.id}</td>
                    <td className="py-3 px-4 text-white font-bold">{p.name}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{p.sku}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{p.slug || '—'}</td>
                    <td className="py-3 px-4 text-right text-white">{formatPrice(p.base_price_cents)}</td>
                    <td className="py-3 px-4 text-center text-gray-300 text-xs">{(p.images || []).length}</td>
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
                ))}
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded w-full max-w-3xl my-8">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 z-10">
              <h2 className="text-xl font-industrial text-yellow-500">
                {editingId ? `EDIT ${editingId}` : 'ADD PRODUCT'}
              </h2>
              <div className="flex gap-1 mt-3 flex-wrap">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`text-xs px-3 py-1.5 rounded transition-colors ${
                      activeTab === t.key
                        ? 'bg-yellow-500 text-black font-bold'
                        : 'bg-gray-800 text-gray-300 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* --- Basics --- */}
              {activeTab === 'basics' && (
                <div className="space-y-3">
                  {!editingId && (
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">
                        Product ID <span className="text-gray-500">(unique key, lowercase a-z 0-9 -)</span>
                      </label>
                      <input
                        type="text"
                        value={form.id}
                        onChange={e => setField({ id: e.target.value })}
                        placeholder="e.g. 3 or driveshaft-cable-xl"
                        className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none font-mono"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setField({ name: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">SKU *</label>
                      <input
                        type="text"
                        value={form.sku}
                        onChange={e => setField({ sku: e.target.value })}
                        placeholder="KTDC-XXX"
                        className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isStorefront}
                        onChange={e => setField({ isStorefront: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span>Storefront-visible</span>
                    </label>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Sort order</label>
                      <input
                        type="number"
                        value={form.sortOrder}
                        onChange={e => setField({ sortOrder: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">
                        Minimum order quantity <span className="text-gray-500">(units)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.minOrderQuantity}
                        onChange={e => setField({ minOrderQuantity: e.target.value })}
                        placeholder="10"
                        className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                      />
                      <p className="text-gray-500 text-xs mt-1">Cables: 10. Items sold singly (e.g. caging bolt): 1.</p>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">
                        Order step <span className="text-gray-500">(±/− increment)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.orderQuantityStep}
                        onChange={e => setField({ orderQuantityStep: e.target.value })}
                        placeholder="10"
                        className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none"
                      />
                      <p className="text-gray-500 text-xs mt-1">Match the pack size. 10 for cables, 1 for caging bolt.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* --- Pricing --- */}
              {activeTab === 'pricing' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Base price ($) *</label>
                    <input type="number" step="0.01" min="0" value={form.basePrice}
                      onChange={e => setField({ basePrice: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Tier 50+ ($) *</label>
                    <input type="number" step="0.01" min="0" value={form.tier50}
                      onChange={e => setField({ tier50: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Tier 100+ ($) *</label>
                    <input type="number" step="0.01" min="0" value={form.tier100}
                      onChange={e => setField({ tier100: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Tier 200+ ($) *</label>
                    <input type="number" step="0.01" min="0" value={form.tier200}
                      onChange={e => setField({ tier200: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                  </div>
                </div>
              )}

              {/* --- Storefront text --- */}
              {activeTab === 'storefront' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">
                      Slug <span className="text-gray-500">{'(URL path: /products/<slug>)'}</span>
                    </label>
                    <input type="text" value={form.slug}
                      onChange={e => setField({ slug: e.target.value })}
                      placeholder="driveshaft-cable-xl"
                      className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none font-mono" />
                    {editingId && (
                      <p className="text-yellow-500/80 text-xs mt-1">
                        Heads up: changing the slug breaks any existing bookmarks or links to this product.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Short description <span className="text-gray-500">(one line)</span></label>
                    <input type="text" value={form.shortDescription}
                      onChange={e => setField({ shortDescription: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Long description</label>
                    <textarea rows={8} value={form.description}
                      onChange={e => setField({ description: e.target.value })}
                      placeholder="A few paragraphs. Newlines render as paragraphs on the detail page."
                      className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none font-mono" />
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Homepage card</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Tagline <span className="text-gray-500">(yellow text under card title)</span></label>
                        <input type="text" value={form.tagline}
                          onChange={e => setField({ tagline: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Bullets (up to 3)</label>
                        <div className="space-y-2">
                          {form.showcaseBullets.map((b, i) => (
                            <input key={i} type="text" value={b}
                              onChange={e => {
                                const next = [...form.showcaseBullets]; next[i] = e.target.value
                                setField({ showcaseBullets: next })
                              }}
                              placeholder={`Bullet ${i + 1}`}
                              className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">CTA button label</label>
                        <input type="text" value={form.ctaLabel}
                          onChange={e => setField({ ctaLabel: e.target.value })}
                          placeholder="Shop Driveshaft Cable"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- Specs --- */}
              {activeTab === 'specs' && (
                <div>
                  <p className="text-gray-400 text-sm mb-3">Key/value pairs shown in the specifications table on the detail page.</p>
                  <div className="space-y-2">
                    {form.specs.map((row, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" value={row.key}
                          onChange={e => updateSpec(idx, { key: e.target.value })}
                          placeholder="Label (e.g. Cable Diameter)"
                          className="w-1/3 bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                        <input type="text" value={row.value}
                          onChange={e => updateSpec(idx, { value: e.target.value })}
                          placeholder='Value (e.g. 5/32" (4mm))'
                          className="flex-1 bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                        <button type="button" onClick={() => removeSpec(idx)}
                          className="text-red-500 hover:text-red-400 px-2 text-sm">✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addSpec}
                    className="mt-3 text-yellow-500 hover:text-yellow-400 text-sm">
                    + Add spec row
                  </button>
                </div>
              )}

              {/* --- Applications --- */}
              {activeTab === 'applications' && (
                <div>
                  <p className="text-gray-400 text-sm mb-3">Each entry shows as a bullet in the "Designed for" section.</p>
                  <div className="space-y-2">
                    {form.applications.map((value, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" value={value}
                          onChange={e => updateApp(idx, e.target.value)}
                          placeholder="e.g. Class 7-8 Trucks"
                          className="flex-1 bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                        <button type="button" onClick={() => removeApp(idx)}
                          className="text-red-500 hover:text-red-400 px-2 text-sm">✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addApp}
                    className="mt-3 text-yellow-500 hover:text-yellow-400 text-sm">
                    + Add application
                  </button>
                </div>
              )}

              {/* --- Features --- */}
              {activeTab === 'features' && (
                <div>
                  <p className="text-gray-400 text-sm mb-3">Each feature renders as a titled callout in the "Why" section.</p>
                  <div className="space-y-3">
                    {form.features.map((row, idx) => (
                      <div key={idx} className="bg-gray-800/40 border border-gray-700 rounded p-3 space-y-2">
                        <div className="flex gap-2">
                          <input type="text" value={row.title}
                            onChange={e => updateFeature(idx, { title: e.target.value })}
                            placeholder="Feature title"
                            className="flex-1 bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                          <button type="button" onClick={() => removeFeature(idx)}
                            className="text-red-500 hover:text-red-400 px-2 text-sm">✕</button>
                        </div>
                        <textarea rows={2} value={row.description}
                          onChange={e => updateFeature(idx, { description: e.target.value })}
                          placeholder="Feature description"
                          className="w-full bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm rounded focus:border-yellow-500 focus:outline-none" />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addFeature}
                    className="mt-3 text-yellow-500 hover:text-yellow-400 text-sm">
                    + Add feature
                  </button>
                </div>
              )}

              {/* --- Images --- */}
              {activeTab === 'images' && (
                <div>
                  <p className="text-gray-400 text-sm mb-3">
                    First image is the storefront thumbnail; the full list is the detail-page gallery in order. Drag to upload, hover a thumbnail to reorder or remove.
                  </p>
                  {!form.id && !editingId ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/40 px-3 py-2 rounded text-yellow-300 text-sm">
                      Fill in the product ID on the Basics tab first — uploads are namespaced per product.
                    </div>
                  ) : (
                    <ImageUploader
                      value={form.images}
                      onChange={imgs => setField({ images: imgs })}
                      productId={editingId || form.id}
                    />
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="mx-6 mb-4 bg-red-500/10 border border-red-500/40 px-3 py-2 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex justify-end gap-2">
              <button onClick={closeModal} disabled={busy} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
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
