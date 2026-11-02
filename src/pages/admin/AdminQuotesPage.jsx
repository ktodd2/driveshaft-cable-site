import AdminNavigation from '../../components/admin/AdminNavigation'
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import QuoteContactReview from '../../components/admin/QuoteContactReview'

function AdminQuotesPage() {
  const navigate = useNavigate()
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-ktodd-dark">
      {/* Admin Header */}
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
      <AdminNavigation />

      <div className="flex">
        {/* Sidebar */}

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8"><QuoteContactReview /></main>
      </div>
    </div>
  )
}

export default AdminQuotesPage
