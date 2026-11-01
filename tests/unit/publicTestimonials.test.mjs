import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicTestimonials } from '../../src/lib/publicTestimonials.js'
const quote = { id: 'approved-fixture', display_name: 'Customer A.', testimonial_text: 'Test fixture feedback.', approved: true, status: 'approved', consented_to_promo: true,
  customer_name: 'PRIVATE', customer_email: 'private@example.test', token: 'SECRET', order_id: 'PRIVATE', submitted_at: '2026-01-01' }

test('empty or malformed public quotes do not render', () => {
  for (const update of [{ display_name: ' ' }, { testimonial_text: '' }, { testimonial_text: null }]) {
    assert.deepEqual(publicTestimonials([{ ...quote, ...update }]), [])
  }
})

test('public snapshot contains only chosen display credit and quote, never private record fields', () => {
  assert.deepEqual(publicTestimonials([quote]), [{ id: 'approved-fixture', display_name: 'Customer A.', testimonial_text: 'Test fixture feedback.' }])
  assert.doesNotMatch(JSON.stringify(publicTestimonials([quote])), /PRIVATE|SECRET|example.test|submitted_at/)
})

test('feedback section has a bounded number of quotes', () => {
  assert.equal(publicTestimonials(Array(30).fill(quote)).length, 6)
  assert.deepEqual(publicTestimonials(null), [])
})
