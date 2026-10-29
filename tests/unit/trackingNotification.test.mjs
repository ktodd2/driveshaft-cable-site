import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTrackingWorkflow, RETRY_WINDOW_MS } from '../../src/lib/trackingNotification.js'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

function fixture(options = {}) {
  let row = { id: 'order', name: 'Fixture', email: 'fixture@example.test', tracking_number: null, tracking_carrier: null, status: 'confirmed', updated_at: 'old', ...options.row }
  let time = Date.now(), count = 0, updates = 0, readCount = 0, mode = options.mode
  const calls = [], states = [], saved = []
  const client = { from() {
    let patch
    const q = { select: () => q, eq: () => q, update: p => { patch = p; updates++; return q }, single: async () => {
      readCount++
      if (patch) {
        if (mode === 'error') return { error: Error('save failed') }
        if (mode === 'empty') return { data: null }
        if (mode === 'zero') return { error: Error('zero rows') }
        row = { ...row, ...patch }
        if (mode === 'tracking-mismatch') return { data: { ...row, tracking_number: 'wrong' } }
        if (mode === 'email-mismatch') return { data: { ...row, email: 'wrong@example.test' } }
        if (mode === 'array') return { data: [] }
        if (mode === 'mismatch') return { data: { ...row, id: 'wrong' } }
      }
      if (mode === 'read-mismatch' && readCount === 3) return { data: { ...row, email: 'changed@example.test' } }
      return { data: { ...row } }
    } }; return q
  }, functions: { invoke: async (name, { body }) => {
    assert.equal(name, 'send-tracking-email-v2')
    calls.push(body)
    if (mode === 'conflict') return { error: { context: { status: 409 } } }
    if (mode === 'network') throw Error('lost response')
    if (mode === 'malformed') return { data: { success: true } }
    if (mode === 'false') return { data: { success: false, emailId: 'id' } }
    return { data: { success: true, emailId: 'provider-id' } }
  } } }
  const workflow = createTrackingWorkflow(client, { onState: (_, s) => states.push(s), onSaved: r => saved.push(r), now: () => time, uuid: () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}` })
  return { workflow, calls, states, saved, row: () => row, updates: () => updates, setMode: m => mode = m, change: p => row = { ...row, ...p }, advance: ms => time += ms }
}
test('verified save and provider acceptance; concurrent clicks send once', async () => {
  const f = fixture()
  await Promise.all([f.workflow.save('order', ' A ', 'ups'), f.workflow.save('order', 'A', 'ups')])
  assert.equal(f.updates(), 1); assert.equal(f.calls.length, 1)
  assert.equal(f.saved[0].tracking_number, 'A'); assert.equal(f.states.at(-1).emailId, 'provider-id')
})
for (const mode of ['error', 'empty', 'zero', 'array', 'mismatch', 'tracking-mismatch', 'email-mismatch', 'read-mismatch']) test(`unverified ${mode} save never sends`, async () => {
  const f = fixture({ mode }); await f.workflow.save('order', 'A', 'ups'); assert.equal(f.calls.length, 0)
  assert.match(f.states.at(-1).message, /review|Review/)
})
test('missing email preserves tracking without sending', async () => {
  const f = fixture({ row: { email: null } }); await f.workflow.save('order', 'A', 'ups')
  assert.equal(f.row().tracking_number, 'A'); assert.equal(f.calls.length, 0)
})
test('unchanged delivered shipment is no-op', async () => {
  const f = fixture({ row: { tracking_number: 'A', tracking_carrier: 'ups', status: 'delivered' } })
  await f.workflow.save('order', 'A', 'ups'); assert.equal(f.updates(), 0); assert.equal(f.calls.length, 0); assert.equal(f.row().status, 'delivered')
})
for (const mode of ['network', 'malformed', 'false']) test(`${mode} retries reuse identity; repeated/concurrent retry is guarded`, async () => {
  const f = fixture({ mode }); await f.workflow.save('order', 'A', 'ups')
  assert.equal(f.states.at(-1).retry, true)
  await f.workflow.save('order', 'A', 'ups') // cannot lose retry by saving unchanged
  f.setMode('ok')
  await Promise.all([f.workflow.retry('order'), f.workflow.retry('order')]); await f.workflow.retry('order')
  assert.equal(f.calls.length, 2); assert.deepEqual(f.calls[0], f.calls[1]); assert.equal(f.updates(), 1)
})
for (const change of [{ tracking_number: 'B' }, { email: 'new@example.test' }, { updated_at: 'new' }]) test('changed saved snapshot blocks retry', async () => {
  const f = fixture({ mode: 'network' }); await f.workflow.save('order', 'A', 'ups'); f.change(change); await f.workflow.retry('order')
  assert.equal(f.calls.length, 1); assert.equal(f.states.at(-1).retry, false)
})
for (const age of [RETRY_WINDOW_MS, 24 * 3600000]) test(`expired retry ${age} fails closed`, async () => {
  const f = fixture({ mode: 'network' }); await f.workflow.save('order', 'A', 'ups'); f.advance(age); await f.workflow.retry('order'); assert.equal(f.calls.length, 1)
})
test('A to B to A creates three separate notifications', async () => {
  const f = fixture(); for (const n of ['A', 'B', 'A']) await f.workflow.save('order', n, 'ups')
  assert.equal(new Set(f.calls.map(c => c.notificationId)).size, 3)
})

function endpoint({ authorized = true, result = { id: 'provider' }, stale = false } = {}) {
  let handler; const calls = []
  const source = readFileSync(new URL('../../supabase/functions/send-tracking-email-v2/index.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
  const body = { customerEmail: 'fixture@example.test', customerName: 'Fixture', trackingNumber: 'A', trackingCarrier: 'ups', orderId: 'order', savedRevision: 'revision', notificationId: '00000000-0000-4000-8000-000000000001', notificationCreatedAt: Date.now(), templateVersion: 'tracking-v1' }
  const q = { select: () => q, eq: () => q, single: async () => ({ data: { id: 'order', email: body.customerEmail, name: body.customerName, tracking_number: stale ? 'B' : 'A', tracking_carrier: 'ups', updated_at: 'revision' } }) }
  runInNewContext(stripTypeScriptTypes(source), {
    serve: fn => handler = fn, Response, Date, console, createClient: () => {},
    authorizeStoreRequest: async () => authorized, createApiClient: () => ({ from: () => q }), getSupabaseSecretKey: () => 'offline',
    Deno: { env: { get: () => 'offline' } }, fetch: async (url, options) => { calls.push(options); return Response.json(result) },
  })
  return { calls, body, invoke: () => handler(new Request('https://offline.test', { method: 'POST', body: JSON.stringify(body) })) }
}
test('function preserves sender, deterministic key, and accepts repeated requests', async () => {
  const f = endpoint(); assert.equal((await f.invoke()).status, 200); await f.invoke()
  assert.equal(f.calls[0].headers['Idempotency-Key'], f.calls[1].headers['Idempotency-Key'])
  assert.equal(JSON.parse(f.calls[0].body).from, 'Driveshaft Cable <orders@driveshaftcable.com>')
  assert.equal(f.calls[0].body, f.calls[1].body)
})
test('function rejects unauthorized, stale, expired, missing identity and malformed provider success', async () => {
  for (const options of [{ authorized: false }, { stale: true }, { result: {} }]) {
    const f = endpoint(options); assert.notEqual((await f.invoke()).status, 200)
    if (!options.result) assert.equal(f.calls.length, 0)
  }
  for (const patch of [{ notificationCreatedAt: Date.now() - 24 * 3600000 }, { notificationId: null }, { templateVersion: 'other' }]) {
    const f = endpoint(); Object.assign(f.body, patch); assert.equal((await f.invoke()).status, 409); assert.equal(f.calls.length, 0)
  }
})

test('function conflict requires review, not another retry', async () => {
  const f = fixture({ mode: 'conflict' }); await f.workflow.save('order', 'A', 'ups')
  assert.equal(f.states.at(-1).retry, false); await f.workflow.retry('order'); assert.equal(f.calls.length, 1)
})
test('concurrent function requests retain identical provider key and payload', async () => {
  const f = endpoint(); const responses = await Promise.all([f.invoke(), f.invoke()])
  assert.ok(responses.every(r => r.status === 200))
  assert.equal(f.calls[0].headers['Idempotency-Key'], f.calls[1].headers['Idempotency-Key'])
  assert.equal(f.calls[0].body, f.calls[1].body)
})
