import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

function AdminQuotesPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState([])

  useEffect(() => {
    checkAuth()
    loadQuotes()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/admin/login')
      return
    }
    setLoading(false)
  }

  const loadQuotes = async () => {
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setQuotes(data)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase
      .from('quote_requests')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      loadQuotes()
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-yellow-500/20 text-yellow-500',
      responded: 'bg-blue-500/20 text-blue-400',
      converted: 'bg-green-500/20 text-green-400',
      declined: 'bg-red-500/20 text-red-400'
    }
    return styles[status] || styles.new
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
            <Link to="/admin/orders" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Orders
            </Link>
            <Link to="/admin/quotes" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
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
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-industrial text-white">QUOTE REQUESTS</h1>
              <span className="text-gray-400">{quotes.length} total</span>
            </div>

            {quotes.length === 0 ? (
              /* Empty State */
              <div className="bg-gray-800/50 border border-gray-700 p-12 text-center">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h2 className="text-xl font-industrial text-white mb-2">NO QUOTE REQUESTS</h2>
                <p className="text-gray-400">Quote requests will appear here when customers submit them.</p>
              </div>
            ) : (
              /* Quotes Table */
              <div className="bg-gray-800/50 border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-400 text-sm font-normal px-6 py-4">Date</th>
                      <th className="text-left text-gray-400 text-sm font-normal px-6 py-4">Contact</th>
                      <th className="text-left text-gray-400 text-sm font-normal px-6 py-4">Company</th>
                      <th className="text-left text-gray-400 text-sm font-normal px-6 py-4">Qty</th>
                      <th className="text-left text-gray-400 text-sm font-normal px-6 py-4">Status</th>
                      <th className="text-left text-gray-400 text-sm font-normal px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => (
                      <tr key={quote.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                        <td className="px-6 py-4">
                          <div className="text-white text-sm">
                            {format(new Date(quote.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {format(new Date(quote.created_at), 'h:mm a')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white text-sm">{quote.name}</div>
                          <div className="text-gray-400 text-xs">{quote.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300 text-sm">{quote.company || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-yellow-500 font-bold">{quote.quantity || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs uppercase ${getStatusBadge(quote.status)}`}>
                            {quote.status || 'new'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={quote.status || 'new'}
                            onChange={(e) => handleStatusChange(quote.id, e.target.value)}
                            className="bg-gray-800 border border-gray-600 text-white text-sm px-2 py-1 focus:border-yellow-500 focus:outline-none"
                          >
                            <option value="new">New</option>
                            <option value="responded">Responded</option>
                            <option value="converted">Converted</option>
                            <option value="declined">Declined</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Quote Detail Expandable */}
            {quotes.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-industrial text-yellow-500 mb-4">RECENT MESSAGES</h2>
                <div className="space-y-4">
                  {quotes.slice(0, 5).filter(q => q.message).map((quote) => (
                    <div key={quote.id} className="bg-gray-800/50 border border-gray-700 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-white font-bold">{quote.name}</span>
                          <span className="text-gray-400 text-sm ml-2">({quote.company || 'No company'})</span>
                        </div>
                        <span className="text-gray-500 text-xs">
                          {format(new Date(quote.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm">{quote.message}</p>
                      <div className="mt-2 flex items-center gap-4">
                        <a href={`mailto:${quote.email}`} className="text-yellow-500 hover:text-yellow-400 text-sm">
                          Reply via email →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminQuotesPage
