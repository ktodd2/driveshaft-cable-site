import AdminNavigation from '../../components/admin/AdminNavigation'
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
      <AdminNavigation badges={{testimonials:submittedCount}} />

      <div className="flex">

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
