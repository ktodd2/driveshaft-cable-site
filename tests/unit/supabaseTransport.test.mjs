import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modernKeyFetch, createApiClient } from '../../supabase/functions/_shared/supabaseTransport.js'

const secret = 'sb_secret_offline_fixture'
const publishable = 'sb_publishable_offline_fixture'

test('SDK transport strips only API-key bearer copies, preserves user JWTs and request bodies', async () => {
  for (const key of [secret, publishable]) {
    for (const token of [key, 'user.jwt.fixture', 'dedicated-worker-fixture']) {
      let sent
      const fetcher = modernKeyFetch(key, async (input, init) => { sent = { input, ...init }; return new Response() })
      await fetcher('https://offline.test', { method: 'POST', body: '{}', headers: { apikey: key, Authorization: `Bearer ${token}` } })
      assert.equal(sent.headers.get('apikey'), key)
      assert.equal(sent.headers.get('Authorization'), token === key ? null : `Bearer ${token}`)
      assert.equal(sent.body, '{}')
    }
  }
  let headers
  await modernKeyFetch(secret, async (_input, init) => { headers = init.headers })(new Request('https://offline.test', { headers: { apikey: secret, Authorization: `Bearer ${secret}` } }))
  assert.equal(headers.get('Authorization'), null)
  assert.equal(headers.get('apikey'), secret)
})

test('client setup retains auth options and rejects missing configuration without echoing credentials', () => {
  assert.throws(() => createApiClient(() => {}, 'https://offline.test', undefined), /^Error: Supabase API key is not configured$/)
  createApiClient((url, key, options) => {
    assert.equal(key, secret)
    assert.deepEqual(options.auth, { persistSession: false })
    assert.deepEqual(options.global.headers, { Authorization: 'Bearer user.jwt.fixture' })
    assert.equal(typeof options.global.fetch, 'function')
  }, 'https://offline.test', secret, { auth: { persistSession: false }, global: { headers: { Authorization: 'Bearer user.jwt.fixture' } } })
})
