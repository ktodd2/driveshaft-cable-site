// Durable metadata only. Never store bodies, addresses, credentials or provider error payloads.
async function checked(query) {
  const result = await query
  if (result.error) throw Error('Email history storage unavailable')
  return result.data
}
export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
}
export function createEmailRecorder(db, automation, runId = null, transport = fetch) {
  const counts = { accepted: 0, rejected: 0, uncertain: 0, duplicate: 0 }
  return { counts, async send(entity, identity, url, options) {
    const dedupeKey = await digest(JSON.stringify([automation, String(entity), identity]))
    const inserted = await db.from('email_attempts').insert({ automation, entity_id: String(entity), dedupe_key: dedupeKey, run_id: runId }).select('*').single()
    if (inserted.error) {
      if (inserted.error.code !== '23505') throw Error('Email history storage unavailable; no send attempted')
      const prior = await checked(db.from('email_attempts').select('*').eq('dedupe_key', dedupeKey).single())
      counts.duplicate++
      if (prior.status === 'accepted' && prior.provider_id) return Response.json({ id: prior.provider_id })
      // Pending may mean a process stopped after sending. Never take over a lease or blindly resend.
      counts.uncertain++
      return Response.json({ error: 'Existing attempt requires provider verification before retry' }, { status: 409 })
    }
    const id = inserted.data.id
    let response, result
    try {
      response = await transport(url, { ...options, headers: { ...options.headers, 'Idempotency-Key': options.headers?.['Idempotency-Key'] || `ledger/${dedupeKey}` } })
      result = await response.json()
    } catch {
      counts.uncertain++
      await checked(db.from('email_attempts').update({ status: 'uncertain', reason: 'provider_outcome_unknown', finished_at: new Date().toISOString() }).eq('id', id))
      return Response.json({ error: 'Provider outcome unknown; verification required' }, { status: 409 })
    }
    const accepted = response.ok && typeof result.id === 'string' && !!result.id.trim()
    // Server errors, rate limits and malformed success responses are conservative unknowns.
    const status = accepted ? 'accepted' : response.status >= 400 && response.status < 500 && response.status !== 429 ? 'rejected' : 'uncertain'
    counts[status]++
    await checked(db.from('email_attempts').update({ status, provider_id: accepted ? result.id : null,
      reason: accepted ? null : status === 'rejected' ? 'provider_rejected' : 'provider_outcome_unknown', finished_at: new Date().toISOString() }).eq('id', id))
    return accepted ? Response.json({ id: result.id }) : Response.json({ error: 'Provider acceptance not confirmed; review history' }, { status: 409 })
  } }
}
export async function observeEmailRun(db, automation, work) {
  let run
  try { run = await checked(db.from('automation_runs').insert({ automation }).select('id').single()) }
  catch { return Response.json({ error: 'Run history unavailable; no work started' }, { status: 503 }) }
  const recorder = createEmailRecorder(db, automation, run.id)
  try {
    const response = await work(recorder)
    const body = await response.clone().json().catch(() => ({}))
    const counts = ['dispatch-campaigns','check-tracking-status'].includes(automation) ? {} : { ...recorder.counts }
    for (const key of ['considered','sent','failed','skipped_recovered','skipped_recent_winback','skipped_recent_order','checked','delivered','errors','dispatched']) {
      if (Number.isInteger(body[key]) && body[key] >= 0) counts[key] = body[key]
    }
    if (Number.isInteger(counts.considered)) {
      counts.skipped = (counts.skipped_recovered || 0) + (counts.skipped_recent_winback || 0) + (counts.skipped_recent_order || 0)
      counts.eligible = counts.considered - counts.skipped
    }
    if (Array.isArray(body.results)) counts.failed = body.results.filter(r => r.error || r.status >= 400 || r.body?.failed > 0).length
    if (automation === 'check-tracking-status' && Array.isArray(body.results)) {
      counts.credentials_missing = body.results.filter(r => r.status === 'credentials_missing').length
      counts.unresolved_tracking = body.results.filter(r => ['credentials_missing','unknown','lookup_failed'].includes(r.status)).length
    }
    const status = !response.ok || counts.errors > 0 || counts.failed > 0 || counts.rejected > 0 ? 'failed' : counts.uncertain > 0 || counts.unresolved_tracking > 0 ? 'review' : 'completed'
    await checked(db.from('automation_runs').update({ status, counts, finished_at: new Date().toISOString(), reason: response.ok ? null : 'execution_failed' }).eq('id', run.id))
    return response
  } catch {
    await db.from('automation_runs').update({ status: 'review', counts: recorder.counts, reason: 'execution_or_storage_outcome_unknown', finished_at: new Date().toISOString() }).eq('id', run.id)
    return Response.json({ error: 'Execution requires review; do not blindly retry' }, { status: 503 })
  }
}
