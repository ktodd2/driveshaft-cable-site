// Pure rules for the mobile quick-action bar (kept framework-free so they can
// be unit tested with node:test).
//
// The bar is a convenience shortcut, so it must never compete with a page's
// own primary task: it is excluded from transactional and form-first routes
// (cart, checkout, quote, tracking, feedback forms) and from admin.

const EXCLUDED_PREFIXES = [
  '/cart',
  '/checkout',
  '/quote',
  '/order-tracking',
  '/contact',
  '/suggestions',
  '/testimonial',
  '/admin',
]

export function isMobileBarRoute(pathname = '/') {
  const path = pathname.replace(/\/+$/, '') || '/'
  return !EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

// Reveal only once the visitor has scrolled past most of the first screen, so
// the bar never appears on first paint (no load-time jump, no covering the
// hero) and hides while a form field has focus (on-screen keyboard).
export const REVEAL_RATIO = 0.6

export function shouldShowMobileBar({ scrollY = 0, viewportHeight = 0, formFocused = false } = {}) {
  if (formFocused) return false
  if (!viewportHeight) return false
  return scrollY > viewportHeight * REVEAL_RATIO
}

export function isFormField(el) {
  if (!el || !el.tagName) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'select') return true
  if (tag === 'input') {
    const type = (el.getAttribute && el.getAttribute('type')) || 'text'
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type)
  }
  return Boolean(el.isContentEditable)
}
