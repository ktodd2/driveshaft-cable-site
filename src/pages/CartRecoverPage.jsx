import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCartStore } from '../stores/cartStore'

// Landing page hit from abandoned-cart recovery emails. Looks up the
// abandonment row via the security-definer RPC (anon can't SELECT cart_abandonments
// directly), repopulates the cart store, then redirects to /cart.
function CartRecoverPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Missing recovery link.')
      return
    }

    const recover = async () => {
      const { data, error } = await supabase.rpc('get_cart_abandonment_by_token', { p_token: token })

      if (error || !data || data.length === 0) {
        setStatus('error')
        setErrorMsg('This recovery link is invalid or expired.')
        return
      }

      const row = data[0]
      const items = Array.isArray(row.items) ? row.items : []

      // Reset the cart, load the abandoned items back, and carry the recovery
      // discount through so checkout auto-applies it. Code must match the one
      // advertised in supabase/functions/send-abandoned-cart/index.ts.
      useCartStore.setState({
        items,
        recoveryDiscountCode: 'COMEBACK5',
        recoveryEmail: row.email || null,
      })
      navigate('/cart', { replace: true })
    }

    recover()
  }, [token, navigate])

  return (
    <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        {status === 'loading' && (
          <>
            <h1 className="text-3xl font-industrial text-white mb-4">RECOVERING YOUR CART...</h1>
            <p className="text-gray-400">One moment while we load everything back up.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-3xl font-industrial text-white mb-4">
              LINK <span className="text-red-500">EXPIRED</span>
            </h1>
            <p className="text-gray-400 mb-8">{errorMsg}</p>
            <Link to="/products" className="btn-primary">Browse Products</Link>
          </>
        )}
      </div>
    </div>
  )
}

export default CartRecoverPage
