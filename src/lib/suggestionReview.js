// Hints never change status, quarantine, or attention counts. Names/language are not signals.
export const textValue = value => typeof value === 'string' ? value : ''
export function reviewHints(row) {
  if (row.review_state === 'kept') return []
  const message = textValue(row.message).trim()
  const hints = []
  if (/<script\b|javascript\s*:|onerror\s*=/i.test(message)) hints.push('Possible spam: executable markup was submitted. Inspect the plain text before deciding.')
  if ((message.match(/https?:\/\//gi) || []).length >= 3) hints.push('Possible spam: three or more links. This may still be a genuine product request.')
  if (!message) hints.push('Needs context: missing message. This is not evidence of spam.')
  else if (/^[\d\s()+.,#/-]+$/u.test(message)) hints.push('Needs context: numbers only; this may be a part number or phone number, not spam.')
  return hints
}
export function suggestionCounts(rows) {
  return { total: rows.length, attention: rows.filter(r => r.status === 'new' && r.review_state !== 'quarantined').length,
    quarantined: rows.filter(r => r.review_state === 'quarantined').length }
}
export function filterSuggestions(rows, view, search) {
  const query = textValue(search).toLocaleLowerCase()
  return rows.filter(r => (view === 'all' || view === 'review' && (r.review_state === 'quarantined' || reviewHints(r).length > 0) || view === 'new' && r.status === 'new' && r.review_state !== 'quarantined' || view === 'quarantined' && r.review_state === 'quarantined') &&
    [r.name,r.email,r.message,r.status,r.review_state].some(value => textValue(value).toLocaleLowerCase().includes(query)))
}
export function safeMailto(value) {
  const email = textValue(value)
  return /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email) ? `mailto:${encodeURIComponent(email)}` : null
}
export function displayDate(value) {
  const date = new Date(value)
  return value && Number.isFinite(date.getTime()) ? date.toISOString().replace('T',' ').slice(0,19) + ' UTC' : 'Unknown date'
}
