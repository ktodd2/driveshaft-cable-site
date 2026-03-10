import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import Papa from 'papaparse'

function AdminNewsletterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [subscribers, setSubscribers] = useState([])
  const [filter, setFilter] = useState('all') // all | active | unsubscribed
  const [search, setSearch] = useState('')

  useEffect(() => {
    checkAuth()
    loadSubscribers()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/admin/login')
      return
    }
    setLoading(false)
  }

  const loadSubscribers = async () => {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSubscribers(data)
    }
  }

  const handleUnsubscribe = async (id) => {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) loadSubscribers()
  }

  const handleResubscribe = async (id) => {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'active', unsubscribed_at: null })
      .eq('id', id)

    if (!error) loadSubscribers()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this subscriber?')) return
    const { error } = await supabase
      .from('newsletter_subscribers')
      .delete()
      .eq('id', id)

    if (!error) loadSubscribers()
  }

  const handleExportCSV = () => {
    const active = subscribers.filter(s => s.status === 'active')
    const csv = Papa.unparse(active.map(s => ({
      email: s.email,
      source: s.source,
      subscribed_at: s.subscribed_at
    })))
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter-subscribers-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  // Filtered subscribers
  const filtered = subscribers.filter(s => {
    if (filter === 'active' && s.status !== 'active') return false
    if (filter === 'unsubscribed' && s.status !== 'unsubscribed') return false
    if (search && !s.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Stats
  const activeCount = subscribers.filter(s => s.status === 'active').length
  const totalCount = subscribers.length
  const sourceBreakdown = subscribers
    .filter(s => s.status === 'active')
    .reduce((acc, s) => {
      acc[s.source] = (acc[s.source] || 0) + 1
      return acc
    }, {})

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
            <Link to="/admin/newsletter" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <h1 className="text-3xl font-industrial text-white">NEWSLETTER</h1>
              <button
                onClick={handleExportCSV}
                disabled={activeCount === 0}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors disabled:opacity-50"
              >
                Export Active CSV
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800/50 border border-gray-700 rounded p-4">
                <p className="text-gray-400 text-sm">Active Subscribers</p>
                <p className="text-2xl font-bold text-yellow-500">{activeCount}</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded p-4">
                <p className="text-gray-400 text-sm">Total All-Time</p>
                <p className="text-2xl font-bold text-white">{totalCount}</p>
              </div>
              {Object.entries(sourceBreakdown).map(([source, count]) => (
                <div key={source} className="bg-gray-800/50 border border-gray-700 rounded p-4">
                  <p className="text-gray-400 text-sm capitalize">{source.replace('_', ' ')}</p>
                  <p className="text-2xl font-bold text-white">{count}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex gap-2">
                {['all', 'active', 'unsubscribed'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-sm rounded transition-colors capitalize ${
                      filter === f
                        ? 'bg-yellow-500 text-black font-semibold'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-yellow-500 flex-1 max-w-xs"
              />
            </div>

            {/* Subscribers Table */}
            {filtered.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 p-12 text-center rounded">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h2 className="text-xl font-industrial text-white mb-2">NO SUBSCRIBERS</h2>
                <p className="text-gray-400">Newsletter subscribers will appear here.</p>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700 rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 text-sm font-normal px-4 py-3">Email</th>
                        <th className="text-left text-gray-400 text-sm font-normal px-4 py-3">Source</th>
                        <th className="text-left text-gray-400 text-sm font-normal px-4 py-3">Status</th>
                        <th className="text-left text-gray-400 text-sm font-normal px-4 py-3">Date</th>
                        <th className="text-right text-gray-400 text-sm font-normal px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(sub => (
                        <tr key={sub.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-white text-sm">{sub.email}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded capitalize">
                              {sub.source?.replace('_', ' ') || 'unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              sub.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {sub.subscribed_at ? format(new Date(sub.subscribed_at), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-2 justify-end">
                              {sub.status === 'active' ? (
                                <button
                                  onClick={() => handleUnsubscribe(sub.id)}
                                  className="text-xs text-gray-400 hover:text-yellow-500 transition-colors"
                                >
                                  Unsubscribe
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleResubscribe(sub.id)}
                                  className="text-xs text-gray-400 hover:text-green-400 transition-colors"
                                >
                                  Resubscribe
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(sub.id)}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-700 text-gray-400 text-sm">
                  Showing {filtered.length} of {totalCount} subscribers
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminNewsletterPage
