import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { memoryDb } from '../fixtures/emailHealthDb.mjs'
import { marketingAudience, loadMarketingAudience, loadProviderMarketingExclusions, sendMarketingRecipients } from '../../supabase/functions/_shared/marketingEmail.js'

const campaign = { id: 42, subject: 'Black Friday', html_content: '<p>20% off</p>' }
const options = { apiKey: 'test-only', wait: async () => {} }
function deliveryDb() {
  const db = memoryDb()
  db.tables.email_campaign_recipients = []
  const from = db.from
  db.from = table => table === 'email_campaign_recipients' ? {
    async upsert(row) {
      if (!db.tables[table].some(r => r.campaign_id === row.campaign_id && r.cycle === row.cycle && r.email === row.email)) db.tables[table].push(row)
      return { error: null }
    },
  } : from(table)
  return db
}

test('paid orders and quotes cannot bypass global or provider opt-outs; eligible sources remain deduplicated', () => {
  const audience = marketingAudience({
    orders: [
      { email: ' A@example.test ', payment_status: 'paid' },
      { email: 'blocked@example.test', payment_status: 'paid' },
      { email: 'provider@example.test', payment_status: 'paid' },
      { email: 'inactive@example.test', payment_status: 'pending' },
      { email: 'dated@example.test', payment_status: 'paid' },
    ],
    quotes: [{ email: 'BLOCKED@example.test', status: 'new' }, { email: 'quote@example.test', status: null }, { email: 'held@example.test', status: 'quarantined' }],
    subscribers: [
      { email: 'a@example.test', status: 'active', confirmed: true },
      { email: 'blocked@example.test', status: 'unsubscribed', confirmed: true },
      { email: 'dated@example.test', status: 'active', confirmed: true, unsubscribed_at: '2026-11-20' },
      { email: 'unconfirmed@example.test', status: 'active', confirmed: false },
    ],
  }, new Set([' PROVIDER@example.test ']))
  assert.deepEqual(audience, { emails: ['a@example.test', 'quote@example.test'], candidates: 5, total: 2, excludedOptOut: 2, excludedProvider: 1 })
})

test('database audience exhausts pages and fails closed if any source cannot be read', async () => {
  const seen = []
  const db = { from(table) {
    return { select() { return this }, order() { return this }, async range(start) {
      seen.push([table, start])
      return { data: table === 'orders' ? start === 0 ? Array.from({ length: 1000 }, (_, id) => ({ id, email: `paid${id}@example.test`, payment_status: 'paid' })) : [{ id: 1000, email: 'last@example.test', payment_status: 'paid' }] : [] }
    } }
  } }
  const audience = await loadMarketingAudience(db, new Set())
  assert.equal(audience.total, 1001)
  assert.ok(seen.some(([table, start]) => table === 'orders' && start === 1000))
  await assert.rejects(loadMarketingAudience({ from: () => ({ select() { return this }, order() { return this }, range: async () => ({ error: true }) }) }, new Set()), /no send started/)
})

test('provider exclusions exhaust both lists and combine unsubscribed contacts with all suppression origins', async () => {
  const calls = [], waits = []
  const excluded = await loadProviderMarketingExclusions('test-only', {
    wait: async ms => waits.push(ms),
    transport: async value => {
      const url = new URL(value); calls.push(url)
      if (url.pathname === '/contacts') return Response.json(url.searchParams.has('after')
        ? { data: [{ id: 'contact2', email: 'unsub@example.test', unsubscribed: true }], has_more: false }
        : { data: [{ id: 'contact1', email: 'active@example.test', unsubscribed: false }], has_more: true })
      return Response.json({ data: [{ id: 'suppression1', email: 'bounce@example.test', origin: 'bounce' }, { id: 'suppression2', email: 'manual@example.test', origin: 'manual' }], has_more: false })
    },
  })
  assert.deepEqual([...excluded].sort(), ['bounce@example.test', 'manual@example.test', 'unsub@example.test'])
  assert.equal(calls.length, 3)
  assert.equal(calls[1].searchParams.get('after'), 'contact1')
  assert.ok(calls.every(url => url.searchParams.get('limit') === '100'))
  assert.deepEqual(waits, [600, 600, 600])
})

for (const mode of ['denied', 'network', 'missing-pagination', 'missing-preference', 'empty-next-page', 'cursor-loop']) {
  test(`provider preflight rejects ${mode} instead of using a partial exclusion list`, async () => {
    let requests = 0
    await assert.rejects(loadProviderMarketingExclusions('test-only', {
      wait: async () => {}, transport: async () => {
        requests++
        if (mode === 'network') throw Error('private details')
        if (mode === 'denied') return Response.json({ error: 'restricted key' }, { status: 403 })
        if (mode === 'missing-pagination') return Response.json({ data: [] })
        if (mode === 'missing-preference') return Response.json({ data: [{ id: 'c1', email: 'x@example.test' }], has_more: false })
        if (mode === 'empty-next-page') return Response.json({ data: [], has_more: true })
        return Response.json({ data: [{ id: 'same', email: 'x@example.test', unsubscribed: false }], has_more: true })
      },
    }), /no send started/)
    assert.ok(requests <= 2)
  })
}

test('recipient requests keep fixed membership, explicit Reply-To and durable provider IDs across reordered resumes', async () => {
  const db = deliveryDb(), calls = []
  const transport = async (url, request) => {
    calls.push({ url, key: request.headers['Idempotency-Key'], body: JSON.parse(request.body) })
    return Response.json({ id: `provider-${calls.length}` })
  }
  await sendMarketingRecipients(db, campaign, 1, ['first@example.test', 'second@example.test'], { ...options, transport })
  // Simulate missing campaign-recipient rows after a provider-accepted run.
  db.tables.email_campaign_recipients.length = 0
  const resumed = await sendMarketingRecipients(db, campaign, 1, ['second@example.test', 'first@example.test'], { ...options, transport })
  assert.equal(calls.length, 2)
  assert.equal(resumed.acceptedCount, 2)
  assert.ok(calls.every(c => c.url === 'https://api.resend.com/emails' && c.body.to.length === 1 && c.body.reply_to === 'admin@driveshaftcable.com' && c.body.from === 'Driveshaft Cable <admin@driveshaftcable.com>'))
  assert.ok(calls.every(c => /^marketing\/42\/1\/[a-f0-9]{64}$/.test(c.key)))
  assert.deepEqual(db.tables.email_attempts.map(row => row.provider_id), ['provider-1', 'provider-2'])
  assert.ok(!JSON.stringify(db.tables.email_attempts).includes('@example.test'))
  await sendMarketingRecipients(db, campaign, 2, ['first@example.test'], { ...options, transport })
  assert.equal(calls.length, 3)
  assert.notEqual(calls[0].key, calls[2].key)
})

test('accepted ledger survives recipient-log failure without another provider request', async () => {
  const db = deliveryDb(), originalFrom = db.from
  let fail = true, requests = 0
  db.from = table => table === 'email_campaign_recipients' && fail ? { upsert: async () => ({ error: true }) } : originalFrom(table)
  const transport = async () => { requests++; return Response.json({ id: 'saved-provider-id' }) }
  await assert.rejects(sendMarketingRecipients(db, campaign, 1, ['one@example.test'], { ...options, transport }), /Recipient log unavailable/)
  fail = false
  await sendMarketingRecipients(db, campaign, 1, ['one@example.test'], { ...options, transport })
  assert.equal(requests, 1)
  assert.equal(db.tables.email_campaign_recipients.length, 1)
})

for (const mode of ['network', 'malformed', 'rejected']) {
  test(`${mode} outcomes remain held while a resumed run can still send new recipients`, async () => {
    const db = deliveryDb(); let requests = 0
    const transport = async () => {
      requests++
      if (requests > 1) return Response.json({ id: 'new-recipient' })
      if (mode === 'network') throw Error('unknown provider state')
      return Response.json(mode === 'malformed' ? {} : { error: 'rejected' }, { status: mode === 'rejected' ? 422 : 200 })
    }
    const first = await sendMarketingRecipients(db, campaign, 1, ['held@example.test'], { ...options, transport })
    assert.equal(first.reviewCount, 1)
    assert.equal(first.complete, false)
    const resumed = await sendMarketingRecipients(db, campaign, 1, ['held@example.test', 'new@example.test'], { ...options, transport, maxRecipients: 1 })
    assert.equal(requests, 2)
    assert.equal(resumed.acceptedCount, 1)
    assert.equal(resumed.reviewCount, 1)
    assert.equal(resumed.remaining, 0)
  })
}

test('bounded runs return safe remaining work and resume without duplicating accepted recipients', async () => {
  const db = deliveryDb(); let requests = 0
  const transport = async () => Response.json({ id: `provider-${++requests}` })
  const first = await sendMarketingRecipients(db, campaign, 1, ['a@example.test', 'b@example.test', 'c@example.test'], { ...options, transport, maxRecipients: 2 })
  assert.equal(first.acceptedCount, 2); assert.equal(first.remaining, 1); assert.equal(first.complete, false)
  const next = await sendMarketingRecipients(db, campaign, 1, ['c@example.test'], { ...options, transport, maxRecipients: 2 })
  assert.equal(next.complete, true); assert.equal(requests, 3)
})

test('endpoint preview is explicit and returns before campaign creation or claims', async () => {
  const source = await readFile(new URL('../../supabase/functions/send-marketing-email/index.ts', import.meta.url), 'utf8')
  assert.ok(source.indexOf("if (body.action === 'preview')") < source.indexOf(".insert({"))
  assert.ok(source.includes("['testEmail', 'recipients', 'dryRun'].some"))
  assert.ok(source.includes("if (req.method !== 'POST')"))
  assert.ok(!source.includes("https://api.resend.com/emails/batch"))
})
