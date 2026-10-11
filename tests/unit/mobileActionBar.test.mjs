// Unit tests (node:test, no dependencies): `node --test tests/unit`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMobileBarRoute, shouldShowMobileBar, isFormField, REVEAL_RATIO } from '../../src/lib/mobileActionBar.js'

test('mobile bar is offered on browsing routes', () => {
  for (const p of ['/', '/products', '/products/driveshaft-cable', '/about', '/faq', '/instructions', '/blog', '/blog/some-post', '/no-such-page']) {
    assert.equal(isMobileBarRoute(p), true, p)
  }
})

test('mobile bar is excluded from transactional, form-first and admin routes', () => {
  for (const p of ['/cart', '/cart/', '/cart/recover/abc', '/checkout', '/checkout/success', '/quote', '/order-tracking', '/contact', '/suggestions', '/testimonial', '/admin', '/admin/login', '/admin/orders']) {
    assert.equal(isMobileBarRoute(p), false, p)
  }
})

test('prefix matching does not over-exclude look-alike paths', () => {
  assert.equal(isMobileBarRoute('/cartography'), true)
  assert.equal(isMobileBarRoute('/quotes-blog'), true)
})

test('bar stays hidden on first paint and until most of the first screen is scrolled', () => {
  assert.equal(shouldShowMobileBar({ scrollY: 0, viewportHeight: 844 }), false)
  assert.equal(shouldShowMobileBar({ scrollY: 844 * REVEAL_RATIO, viewportHeight: 844 }), false)
  assert.equal(shouldShowMobileBar({ scrollY: 844 * REVEAL_RATIO + 1, viewportHeight: 844 }), true)
})

test('bar hides while a form field has focus and when viewport is unknown', () => {
  assert.equal(shouldShowMobileBar({ scrollY: 5000, viewportHeight: 844, formFocused: true }), false)
  assert.equal(shouldShowMobileBar({ scrollY: 5000, viewportHeight: 0 }), false)
  assert.equal(shouldShowMobileBar(), false)
})

test('isFormField recognises text-entry controls only', () => {
  const el = (tagName, type) => ({ tagName, getAttribute: (n) => (n === 'type' ? type ?? null : null) })
  assert.equal(isFormField(el('INPUT')), true)
  assert.equal(isFormField(el('INPUT', 'email')), true)
  assert.equal(isFormField(el('TEXTAREA')), true)
  assert.equal(isFormField(el('SELECT')), true)
  assert.equal(isFormField(el('INPUT', 'checkbox')), false)
  assert.equal(isFormField(el('INPUT', 'submit')), false)
  assert.equal(isFormField(el('BUTTON')), false)
  assert.equal(isFormField(null), false)
  assert.equal(isFormField({ tagName: 'DIV', isContentEditable: true }), true)
})
