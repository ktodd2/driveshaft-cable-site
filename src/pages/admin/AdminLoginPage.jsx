import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function AdminLoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      })

      if (error) throw error

      // Check if user is an admin
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, role')
        .eq('id', data.user.id)
        .eq('is_active', true)
        .single()

      if (adminError || !adminData) {
        await supabase.auth.signOut()
        throw new Error('You do not have admin access.')
      }

      navigate('/admin')
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.')
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen bg-ktodd-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500 rounded flex items-center justify-center">
              <span className="text-black font-bold text-xl font-industrial">K</span>
            </div>
            <div>
              <div className="text-yellow-500 font-industrial text-xl tracking-wider">DRIVESHAFT CABLE</div>
              <div className="text-gray-400 text-xs tracking-widest">BY K.TODD</div>
            </div>
          </Link>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800/50 border border-gray-700 p-8">
          <h1 className="text-2xl font-industrial text-yellow-500 mb-6 text-center">ADMIN LOGIN</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-gray-400 text-sm mb-1">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="admin@example.com"
                className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-gray-400 text-sm mb-1">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-gray-400 hover:text-yellow-500 text-sm transition-colors">
              ← Back to Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage
