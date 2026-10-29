import { createApiClient } from '../../supabase/functions/_shared/supabaseTransport.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { measurementPayload } from '../../supabase/functions/_shared/ga4Outbox.js'

function load(name, mocks) {
 let handler
 const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
 runInNewContext(stripTypeScriptTypes(source), { serve: fn => { handler = fn }, Request, Response, Date, Error, createApiClient, getSupabaseSecretKey: () => 'runtime-service', ...mocks })
 return handler
}
const post = token => new Request('https://offline.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
test('actual analytics webhook authenticates before enqueue; durable errors retry without payment side effects', async () => {
 let valid = false, fail = false, calls = 0
 class Stripe { static createSubtleCryptoProvider() { return {} } webhooks = { constructEventAsync: async () => { if (!valid) throw Error('bad'); return { type: 'fixture' } } } }
 const handler = load('analytics-webhook', { Stripe, createClient: () => ({}), Deno: { env: { get: () => 'fixture' } }, enqueuePurchase: async () => { calls++; if (fail) throw Error('db') } })
 assert.equal((await handler(post('x'))).status, 400); assert.equal(calls,0)
 valid = true; assert.equal((await handler(post('x'))).status,200)
 fail = true; assert.equal((await handler(post('x'))).status,503)
})

test('actual worker: auth/config gates, safe retries, claim loss and transport quarantine', async () => {
 for (const scenario of ['auth','missing-token','legacy-only','old-token','runtime-key','disabled','empty','read-fails','skip','claim-lost','submitted','uncertain','rejected','ack-fails']) {
  let sends = 0, claims = 0, reads = 0
  const updates = []
  const row = { order_id: 'fixture', intent_id: 'pi_fixture', claim_token: 'token', attempts: 1, paid_at: new Date().toISOString() }
  const db = { rpc: async () => { claims++; return { data: scenario === 'empty' ? [] : [row] } }, from: () => ({ update: values => {
   updates.push(values)
   const chain = { eq: () => chain, gt: () => chain, select: async () => ({ data: scenario === 'claim-lost' || (scenario === 'ack-fails' && values.state === 'submitted') ? [] : [{ order_id: row.order_id }] }) }
   return chain
  } }) }
  class Stripe { paymentIntents = { retrieve: async () => { reads++; if (scenario === 'read-fails') throw Error('stripe'); return {} } } }
  const handler = load('report-purchases', { Stripe, createClient: (url, key) => { assert.equal(key, 'runtime-service'); return db },
   Deno: { env: { get: key => ({ SUPABASE_SERVICE_ROLE_KEY: 'runtime-service', GA4_WORKER_TOKEN: 'legacy-service', GA4_WORKER_TOKEN_V2: ['missing-token','legacy-only'].includes(scenario) ? undefined : 'service', GA4_API_SECRET: 'fixture', GA4_DELIVERY_ENABLED: scenario === 'disabled' ? 'false' : 'true' })[key] } },
   measurementPayload: () => scenario === 'skip' ? { skip: 'refunded_or_unverified' } : { payload: {} },
   transmitPurchase: async () => { sends++; return ['uncertain','rejected'].includes(scenario) ? scenario : 'submitted' } })
  const response = await handler(post(scenario === 'auth' ? 'anon' : scenario === 'runtime-key' ? 'runtime-service' : ['old-token','legacy-only'].includes(scenario) ? 'legacy-service' : 'service'))
  if (['auth','missing-token','legacy-only','old-token','runtime-key'].includes(scenario)) { assert.equal(response.status,401); assert.equal(claims,0) }
  else if (scenario === 'disabled') { assert.equal(response.status,503); assert.equal(claims,0) }
  else if (scenario === 'empty') assert.equal(reads,0)
  else if (scenario === 'read-fails') { assert.equal(updates[0].state,'pending'); assert.ok(Date.parse(updates[0].available_at) > Date.now()) }
  else if (scenario === 'skip') assert.equal(updates[0].state,'skipped')
  else if (scenario === 'claim-lost') assert.equal(response.status,503)
  else { assert.equal(sends,1); assert.equal(updates[0].state,'sending'); assert.equal(updates[1].state, scenario === 'ack-fails' ? 'submitted' : scenario) }
  if (['auth','missing-token','legacy-only','old-token','runtime-key','disabled','empty','read-fails','skip','claim-lost'].includes(scenario)) assert.equal(sends,0)
 }
})
