import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getShippingAddressProblem as check } from '../../src/lib/shippingAddress.js'

test('accepts US addresses', () => {
  assert.equal(check({ state: 'TX', zip: '77001' }), null)
  assert.equal(check({ state: ' tx ', zip: '77001-1234' }), null)
  assert.equal(check({ state: 'Texas', zip: '77001' }), null)
  assert.equal(check({ state: 'N.Y.', zip: '10001' }), null)
  assert.equal(check({ state: 'PR', zip: '00901' }), null)
})

test('routes Canadian addresses to Royal Rigging', () => {
  assert.equal(check({ state: 'BC', zip: '77001' }), 'canada')
  assert.equal(check({ state: 'Ontario', zip: '' }), 'canada')
  assert.equal(check({ state: 'Québec', zip: 'H2X 1Y4' }), 'canada')
  assert.equal(check({ state: 'Québec', zip: '' }), 'canada')
  assert.equal(check({ state: 'TX', zip: 'v4w0e1' }), 'canada')
  assert.equal(check({ state: 'Canada', zip: '12345' }), 'canada')
})

test('rejects bad states and ZIPs', () => {
  assert.equal(check({ state: 'TXX', zip: '77001' }), 'state')
  assert.equal(check({ state: '', zip: '77001' }), 'state')
  assert.equal(check({ state: 'TX', zip: '7700' }), 'zip')
})
