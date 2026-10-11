import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCartStore, selectTotalItems } from '../../stores/cartStore'
import { isMobileBarRoute, shouldShowMobileBar, isFormField } from '../../lib/mobileActionBar'

// Bottom quick-action bar for small screens. Visibility rules live in
// lib/mobileActionBar.js. Space for it is reserved by the Layout on eligible
// routes, so revealing it never shifts content or covers the footer.
function MobileActionBar() {
  const { pathname } = useLocation()
  const totalItems = useCartStore(selectTotalItems)
  const eligible = isMobileBarRoute(pathname)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!eligible) {
      setVisible(false)
      return undefined
    }
    let formFocused = isFormField(document.activeElement)
    let frame = 0
    const update = () => {
      frame = 0
      setVisible(shouldShowMobileBar({
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        formFocused,
      }))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const onFocusIn = (e) => { formFocused = isFormField(e.target); schedule() }
    const onFocusOut = () => { formFocused = false; schedule() }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [eligible, pathname])

  if (!eligible) return null

  return (
    <nav
      aria-label="Quick actions"
      data-testid="mobile-action-bar"
      data-visible={visible ? 'true' : 'false'}
      aria-hidden={visible ? undefined : 'true'}
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 flex gap-2.5 px-4 pt-2.5 bg-ktodd-dark/95 backdrop-blur-md border-t border-yellow-500/40 transition-[transform,opacity] duration-200 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
    >
      <Link to="/quote" tabIndex={visible ? undefined : -1} className="btn-primary flex-1 px-3">Get Quote</Link>
      {totalItems > 0 ? (
        <Link to="/cart" tabIndex={visible ? undefined : -1} className="btn-secondary px-5">Cart ({totalItems > 99 ? '99+' : totalItems})</Link>
      ) : (
        <Link to="/products" tabIndex={visible ? undefined : -1} className="btn-secondary px-5">Shop</Link>
      )}
    </nav>
  )
}

export default MobileActionBar
