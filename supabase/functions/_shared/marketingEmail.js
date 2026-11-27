import { createEmailRecorder, digest } from './emailHealth.js'

export const MARKETING_FROM = 'Driveshaft Cable <admin@driveshaftcable.com>'
export const MARKETING_REPLY_TO = 'admin@driveshaftcable.com'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : ''

/** The same opt-out must apply to every source, including past paid orders. */
export function marketingAudience({ orders = [], quotes = [], subscribers = [] }, providerExcluded = new Set()) {
  const candidates = new Set()
  const optedOut = new Set(subscribers
    .filter(row => row.status === 'unsubscribed' || row.unsubscribed_at)
    .map(row => normalize(row.email)).filter(Boolean))
  for (const row of orders) if (row.payment_status === 'paid') candidates.add(normalize(row.email))
  for (const row of quotes) if (row.status !== 'quarantined') candidates.add(normalize(row.email))
  for (const row of subscribers) if (row.status === 'active' && row.confirmed === true) candidates.add(normalize(row.email))
  candidates.delete('')
  const suppressed = new Set(Array.from(providerExcluded, normalize))
  let excludedOptOut = 0, excludedProvider = 0
  const emails = Array.from(candidates).sort().filter(email => {
    if (optedOut.has(email)) { excludedOptOut++; return false }
    if (suppressed.has(email)) { excludedProvider++; return false }
    return true
  })
  return { emails, candidates: candidates.size, total: emails.length, excludedOptOut, excludedProvider }
}

async function allRows(db, table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const result = await db.from(table).select(columns).order('id', { ascending: true }).range(from, from + 999)
    if (result.error || !Array.isArray(result.data)) throw Error('Marketing audience unavailable; no send started')
    rows.push(...result.data)
    if (result.data.length < 1000) return rows
  }
}

export async function loadMarketingAudience(db, providerExcluded) {
  const [orders, quotes, subscribers] = await Promise.all([
    allRows(db, 'orders', 'id,email,payment_status'),
    allRows(db, 'quote_requests', 'id,email,status'),
    allRows(db, 'newsletter_subscribers', 'id,email,status,confirmed,unsubscribed_at'),
  ])
  return marketingAudience({ orders, quotes, subscribers }, providerExcluded)
}

/** No partial result is safe: contacts and suppressions must both fully paginate. */
export async function loadProviderMarketingExclusions(apiKey, { transport = fetch, wait = pause } = {}) {
  const excluded = new Set()
  for (const resource of ['contacts', 'suppressions']) {
    let after = null
    const cursors = new Set()
    for (let page = 0; ; page++) {
      if (page >= 1000) throw Error('Provider suppression pagination incomplete; no send started')
      const url = new URL(`https://api.resend.com/${resource}`)
      url.searchParams.set('limit', '100')
      if (after) url.searchParams.set('after', after)
      // Contacts, suppression reads, and sends share the provider's rate limit.
      await wait(600)
      let response, body
      try {
        response = await transport(url.toString(), {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12000),
        })
        body = await response.json()
      } catch { throw Error('Provider suppression check unavailable; no send started') }
      if (!response.ok || !Array.isArray(body?.data) || typeof body.has_more !== 'boolean') {
        throw Error('Provider suppression check unavailable; no send started')
      }
      for (const row of body.data) {
        if (!normalize(row.email) || typeof row.id !== 'string' || !row.id ||
            (resource === 'contacts' && typeof row.unsubscribed !== 'boolean')) {
          throw Error('Provider suppression response incomplete; no send started')
        }
        if (resource === 'suppressions' || row.unsubscribed) excluded.add(normalize(row.email))
      }
      if (!body.has_more) break
      const next = body.data.at(-1)?.id
      if (!next || cursors.has(next)) throw Error('Provider suppression pagination incomplete; no send started')
      cursors.add(next)
      after = next
    }
  }
  return excluded
}

/**
 * One recipient per request fixes membership across retries. The existing durable
 * attempt ledger stores only hashes/IDs, and holds any ambiguous outcome even
 * beyond the provider's 24-hour idempotency window.
 */
export async function sendMarketingRecipients(db, campaign, cycle, emails, {
  apiKey, transport = fetch, wait = pause, clock = Date.now,
  maxRecipients = 50, budgetMs = 60000,
} = {}) {
  const recorder = createEmailRecorder(db, 'send-marketing-email', null, async (url, options) => {
    await wait(600)
    return transport(url, options)
  })
  const started = clock()
  let processed = 0, attempted = 0, acceptedCount = 0, failedCount = 0, uncertainCount = 0
  for (const email of emails) {
    if (attempted >= maxRecipients || clock() - started >= budgetMs) break
    const recipientHash = await digest(normalize(email))
    const idempotencyKey = `marketing/${campaign.id}/${cycle}/${recipientHash}`
    const duplicatesBefore = recorder.counts.duplicate
    const response = await recorder.send(String(campaign.id), [cycle, recipientHash], 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: MARKETING_FROM, reply_to: MARKETING_REPLY_TO, to: [email], subject: campaign.subject, html: campaign.html_content }),
      signal: AbortSignal.timeout(12000),
    })
    const result = await response.json()
    processed++
    if (recorder.counts.duplicate === duplicatesBefore) attempted++
    if (!response.ok || typeof result.id !== 'string' || !result.id) {
      // A held/rejected attempt is not safe automatic work on a later run.
      if (recorder.counts.rejected > failedCount) failedCount++
      else uncertainCount++
      continue
    }
    const { error } = await db.from('email_campaign_recipients').upsert(
      { campaign_id: campaign.id, email: normalize(email), cycle },
      { onConflict: 'campaign_id,cycle,email', ignoreDuplicates: true },
    )
    if (error) throw Error('Recipient log unavailable; resume this campaign only after reviewing its existing attempts')
    acceptedCount++
  }
  const remaining = emails.length - processed
  return {
    sentCount: acceptedCount, acceptedCount, failedCount, uncertainCount,
    reviewCount: failedCount + uncertainCount, remaining,
    complete: remaining === 0 && failedCount === 0 && uncertainCount === 0,
  }
}
