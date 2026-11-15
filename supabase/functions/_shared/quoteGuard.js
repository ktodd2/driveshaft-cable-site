export function normalizeQuote(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid request')
  const limits = { name: 160, company: 240, email: 254, phone: 80, message: 5000, website: 240 }
  const quote = {}
  for (const [field, max] of Object.entries(limits)) {
    const value = input[field] ?? ''
    if (typeof value !== 'string' || value.length > max) throw Error(`Invalid ${field}`)
    quote[field] = value.trim()
  }
  if (!quote.name || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(quote.email) || /[\r\n]/.test(quote.name + quote.email)) throw Error('Please enter a valid name and email')
  quote.email = quote.email.toLowerCase()
  const quantity = input.quantity
  if (quantity != null && quantity !== '' && (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647)) throw Error('Please enter a valid quantity')
  quote.quantity = quantity === '' || quantity == null ? null : quantity
  if (typeof input.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id)) throw Error('Please refresh the form and try again')
  quote.request_id = input.request_id
  quote.started_at = Number.isFinite(input.started_at) ? input.started_at : null
  return quote
}

export function quoteRiskReasons(quote, now = Date.now()) {
  const reasons = []
  if (quote.website) reasons.push('honeypot')
  // A long mixed-case token used as the entire message merits review, not deletion. Never
  // reject by email provider, country, language, quantity, or name length alone.
  const randomToken = value => /^[A-Za-z]{12,}$/.test(value) && (value.match(/[a-z][A-Z]|[A-Z][a-z]/g) || []).length >= 5
  if (quote.message.length >= 18 && randomToken(quote.message)) reasons.push('random_token_message')
  else if ([quote.name, quote.company, quote.message].filter(randomToken).length >= 2) reasons.push('multiple_random_tokens')
  return reasons
}
export function escapeQuoteHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}
export function quoteNotification(quote, quoteId) {
  const fields = [['Name', quote.name], ['Company', quote.company], ['Email', quote.email], ['Phone', quote.phone], ['Quantity', quote.quantity], ['Message', quote.message]]
  const text = `New Driveshaft Cable quote #${quoteId}\n\n` + fields.filter(([,v]) => v !== '' && v != null).map(([k,v]) => `${k}: ${v}`).join('\n')
  const html = '<h1>New Driveshaft Cable quote #' + escapeQuoteHtml(quoteId) + '</h1>' + fields.filter(([,v]) => v !== '' && v != null).map(([k,v]) => `<p><strong>${k}:</strong> <span style="white-space:pre-wrap">${escapeQuoteHtml(v)}</span></p>`).join('')
  return {from:'Driveshaft Cable <admin@driveshaftcable.com>', to:['kurtis@k-todd.com'], subject:`New Quote Request #${quoteId}`, reply_to:quote.email, text, html}
}
export async function quoteHash(secret, label, value) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`quote-guard-v1:${label}:${value}`)))
  return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('')
}
