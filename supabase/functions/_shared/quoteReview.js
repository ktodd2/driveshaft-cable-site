// Explicit projections avoid returning addresses, payment IDs, or email HTML.
export const reviewSources = {
  quotes: ['quote_requests', 'id,name,email,company,phone,quantity,message,status,created_at'],
  orders: ['orders', 'id,email,status,payment_status,total_cents,created_at'],
  sends: ['email_campaign_recipients', 'id,email,campaign_id,cycle,sent_at'],
  preferences: ['newsletter_subscribers', 'id,email,status,unsubscribed_at'],
}

export async function readReviewSources(client) {
  return Object.fromEntries(await Promise.all(Object.entries(reviewSources).map(async ([key, [table, fields]]) => {
    try {
      const rows = []
      for (let start = 0; ; start += 500) {
        const { data, error } = await client.from(table).select(fields).order('id', { ascending: true }).range(start, start + 499)
        if (error || !Array.isArray(data)) throw Error('Unavailable')
        rows.push(...data)
        if (data.length < 500) break
      }
      return [key, { rows }]
    } catch { return [key, { rows: [], error: true }] }
  })))
}
