import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { createApiClient } from '../../supabase/functions/_shared/supabaseTransport.js'
import { isActiveAdmin } from '../../supabase/functions/_shared/storeAuthorization.js'
import { hasBackendApiKey } from '../../supabase/functions/_shared/supabaseKeys.js'

const backend = 'sb_secret_offline_fixture'
const publicKey = 'sb_publishable_offline_fixture'
const functions = ['dispatch-campaigns', 'process-testimonial-queue', 'send-marketing-email',
  'send-abandoned-cart', 'send-welcome-series', 'send-reorder-reminder', 'send-winback']

function load(name, { validUser = false, activeAdmin = false } = {}) {
  let handler, privileged = 0, network = 0
  const stop = new Error('offline privileged boundary')
  const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
  runInNewContext(stripTypeScriptTypes(source), {
    serve: fn => { handler = fn }, Request, Response, Date, Error, Headers, URL, Set, Promise,
    console: { error() {}, log() {}, warn() {} },
    getSupabaseSecretKey: () => backend, getSupabasePublishableKey: () => publicKey,
    hasBackendApiKey, createApiClient, isActiveAdmin,
    Deno: { env: { get: name => ({ SUPABASE_URL: 'https://offline.test', CRON_TRIGGER_KEY: 'offline-cron-fixture' })[name] } },
    createClient: (_url, key) => {
      if (key === backend) { privileged++; throw stop }
      assert.equal(key, publicKey)
      return { auth: { getUser: async () => ({ data: { user: validUser ? { id: 'offline-user', user_metadata: { role: 'admin' } } : null } }) }, from: table => {
        assert.equal(table, 'admin_users')
        const filters = []
        const chain = { select: () => chain, eq: (k,v) => { filters.push([k,v]); return chain }, maybeSingle: async () => {
          assert.deepEqual(filters, [['id','offline-user'],['is_active',true]])
          return { data: activeAdmin ? { id: 'offline-user' } : null }
        } }
        return chain
      } }
    },
    fetch: () => { network++; throw new Error('network forbidden') },
  })
  return { handler, stop, counts: () => ({ privileged, network }) }
}

for (const name of functions) {
  test(`${name}: absent, public, wrong and legacy bearer credentials reject before privileged work`, async () => {
    for (const headers of [{}, { apikey: publicKey }, { apikey: 'sb_secret_wrong' },
      { Authorization: 'Bearer legacy-offline-fixture' }, { Authorization: `Bearer ${backend}` }]) {
      const fixture = load(name)
      const response = await fixture.handler(new Request('https://offline.test', { method: 'POST', headers }))
      assert.equal(response.status, 401)
      assert.deepEqual(fixture.counts(), { privileged: 0, network: 0 })
    }
  })
  test(`${name}: configured backend apikey reaches only the mocked privileged boundary`, async () => {
    const fixture = load(name)
    await assert.rejects(fixture.handler(new Request('https://offline.test', {
      method: 'POST', headers: { apikey: backend },
    })), error => error === fixture.stop)
    assert.deepEqual(fixture.counts(), { privileged: 1, network: 0 })
  })
}

for (const name of functions) {
  test(`${name}: user metadata cannot grant admin access; active database membership can`, async () => {
    const request = () => new Request('https://offline.test', { method: 'POST', headers: { Authorization: 'Bearer offline-user-jwt' } })
    const ordinary = load(name, { validUser: true })
    assert.equal((await ordinary.handler(request())).status, 401)
    assert.deepEqual(ordinary.counts(), { privileged: 0, network: 0 })
    const admin = load(name, { validUser: true, activeAdmin: true })
    await assert.rejects(admin.handler(request()), error => error === admin.stop)
    assert.deepEqual(admin.counts(), { privileged: 1, network: 0 })
  })
}
