import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

function AdminTestimonialsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [testimonials, setTestimonials] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filter, setFilter] = useState('all')  // all | submitted | approved | archived

  useEffect(() => {
    checkAuth()
    loadTestimonials()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/admin/login')
      return
    }
    setLoading(false)
  }

  const loadTestimonials = async () => {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .neq('status', 'pending')  // hide unsubmitted requests; they're noise
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTestimonials(data)
    }
  }

  const handleApprove = async (id) => {
    const { error } = await supabase
      .from('testimonials')
      .update({ approved: true, status: 'approved' })
      .eq('id', id)
    if (!error) {
      setTestimonials(prev => prev.map(t => t.id === id ? { ...t, approved: true, status: 'approved' } : t))
    }
  }

  const handleArchive = async (id) => {
    const { error } = await supabase
      .from('testimonials')
      .update({ approved: false, status: 'archived' })
      .eq('id', id)
    if (!error) {
      setTestimonials(prev => prev.map(t => t.id === id ? { ...t, approved: false, status: 'archived' } : t))
    }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('testimonials').delete().eq('id', id)
    if (!error) {
      setTestimonials(prev => prev.filter(t => t.id !== id))
      setConfirmDelete(null)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const getStatusBadge = (status) => {
    const styles = {
      submitted: 'bg-yellow-500/20 text-yellow-500',
      approved: 'bg-green-500/20 text-green-400',
      archived: 'bg-gray-700/40 text-gray-500',
    }
    return styles[status] || styles.submitted
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ktodd-dark flex items-center justify-center">
        <div className="text-yellow-500">Loading...</div>
      </div>
    )
  }

  const submittedCount = testimonials.filter(t => t.status === 'submitted').length
  const visible = filter === 'all' ? testimonials : testimonials.filter(t => t.status === filter)

  return (
    <div className="min-h-screen bg-ktodd-dark">
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
            <Link to="/admin/suggestions" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Suggestions
            </Link>
            <Link to="/admin/testimonials" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Testimonials
              {submittedCount > 0 && (
                <span className="ml-auto bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">{submittedCount}</span>
              )}
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

        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <h1 className="text-3xl font-industrial text-white">TESTIMONIALS</h1>
              <div className="flex items-center gap-2 text-sm">
                {['all','submitted','approved','archived'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 ${filter === f ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-gray-400 mb-6 text-sm">
              {testimonials.length} total{submittedCount > 0 ? ` · ${submittedCount} awaiting review` : ''}
            </p>

            {visible.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 p-12 text-center">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <h2 className="text-xl font-industrial text-white mb-2">NO TESTIMONIALS YET</h2>
                <p className="text-gray-400">
                  Submitted testimonials will appear here. Emails go out to customers 14 days after their paid order.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-gray-800/50 border p-5 ${t.status === 'submitted' ? 'border-yellow-500/40' : 'border-gray-700'}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold">{t.display_name || t.customer_name}</span>
                          {t.display_name && t.display_name !== t.customer_name && (
                            <span className="text-gray-500 text-xs">(actual: {t.customer_name})</span>
                          )}
                          <a
                            href={`mailto:${t.customer_email}`}
                            className="text-yellow-500 hover:text-yellow-400 text-sm break-all"
                          >
                            {t.customer_email}
                          </a>
                          <span className={`px-2 py-0.5 text-xs uppercase ${getStatusBadge(t.status)}`}>
                            {t.status}
                          </span>
                          {t.approved && (
                            <span className="px-2 py-0.5 text-xs uppercase bg-green-500/10 text-green-400 border border-green-500/30">
                              OK FOR PROMO
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          Submitted {t.submitted_at ? format(new Date(t.submitted_at), 'MMM d, yyyy · h:mm a') : '—'}
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-200 text-sm whitespace-pre-wrap mb-4 italic">"{t.testimonial_text}"</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {t.status === 'submitted' && (
                        <button
                          onClick={() => handleApprove(t.id)}
                          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white font-bold transition-colors"
                        >
                          Approve for promo
                        </button>
                      )}
                      {t.status === 'approved' && (
                        <button
                          onClick={() => handleArchive(t.id)}
                          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                        >
                          Unapprove
                        </button>
                      )}
                      {t.status !== 'archived' && t.status !== 'approved' && (
                        <button
                          onClick={() => handleArchive(t.id)}
                          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        >
                          Archive
                        </button>
                      )}
                      {t.status === 'archived' && (
                        <button
                          onClick={() => handleApprove(t.id)}
                          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      <a
                        href={`mailto:${t.customer_email}`}
                        className="px-3 py-1 text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition-colors"
                      >
                        Reply via email
                      </a>
                      {confirmDelete === t.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="px-3 py-1 text-xs bg-red-500 hover:bg-red-400 text-white font-bold transition-colors"
                          >
                            Confirm delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          className="ml-auto px-3 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminTestimonialsPage
