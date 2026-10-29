// Session-only workflow: no durable outbox or automatic resend after reload.
export const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000
const snapshot = row => ({ orderId: row.id, trackingNumber: row.tracking_number,
  trackingCarrier: row.tracking_carrier, customerEmail: row.email,
  customerName: row.name, savedRevision: row.updated_at })

export function createTrackingWorkflow(client, { onState, onSaved, now = Date.now, uuid = () => crypto.randomUUID() }) {
  const states = new Map(), busy = new Set()
  const publish = (id, state) => { states.set(id, state); onState(id, state) }
  const read = async id => {
    const { data, error } = await client.from('orders').select('*').eq('id', id).single()
    if (error || !data || data.id !== id) throw Error('Saved order could not be verified. Review before sending.')
    return data
  }
  const send = async (id, state) => {
    const body = state.notification
    if (!body || now() - body.notificationCreatedAt >= RETRY_WINDOW_MS || now() < body.notificationCreatedAt) {
      publish(id, { ...state, retry: false, message: 'Tracking saved. Retry window expired or identity uncertain; review required.' }); return
    }
    let row
    try { row = await read(id) } catch (error) {
      publish(id, { ...state, retry: true, message: `Tracking saved. Email not confirmed: ${error.message}` }); return
    }
    if (JSON.stringify(snapshot(row)) !== JSON.stringify(state.snapshot)) {
      publish(id, { ...state, retry: false, message: 'Tracking saved. Shipment or recipient changed; review required.' }); return
    }
    try {
      const { data, error } = await client.functions.invoke('send-tracking-email-v2', { body })
      if (error?.context?.status === 409) {
        publish(id, { ...state, retry: false, message: 'Tracking saved. Notification no longer matches or has expired; review required.' }); return
      }
      if (error || data?.success !== true || typeof data.emailId !== 'string' || !data.emailId.trim()) throw Error('Email acceptance not confirmed')
      publish(id, { ...state, retry: false, message: 'Tracking saved. Email accepted by provider.', emailId: data.emailId })
    } catch {
      publish(id, { ...state, retry: true, message: 'Tracking saved. Email outcome unconfirmed; retry this same notification safely within 23 hours.' })
    }
  }
  return {
    async save(id, number, carrier) {
      if (busy.has(id) || !number.trim()) return
      const previous = states.get(id)
      busy.add(id)
      publish(id, { message: 'Verifying and saving tracking…', busy: true })
      try {
        const before = await read(id)
        if (before.tracking_number === number.trim() && before.tracking_carrier === carrier) {
          onSaved(before)
          publish(id, previous?.notification ? { ...previous, busy: false } : { message: 'Tracking unchanged. No email sent.' })
          return
        }
        const notificationCreatedAt = now()
        const notificationId = uuid()
        const { data, error } = await client.from('orders').update({ tracking_number: number.trim(),
          tracking_carrier: carrier, status: before.status === 'delivered' ? 'delivered' : 'shipped',
          updated_at: new Date(notificationCreatedAt).toISOString() }).eq('id', id).eq('updated_at', before.updated_at).select('*').single()
        if (error || !data || data.id !== id || data.tracking_number !== number.trim() || data.tracking_carrier !== carrier || data.email !== before.email) throw Error('Save not verified. Review the order before sending.')
        const row = await read(id)
        if (JSON.stringify(snapshot(row)) !== JSON.stringify(snapshot(data))) throw Error('Saved order changed. Review before sending.')
        onSaved(row)
        if (!row.email?.trim()) { publish(id, { message: 'Tracking saved. No customer email; review required.' }); return }
        const state = { snapshot: snapshot(row), notification: { ...snapshot(row), notificationId, notificationCreatedAt, templateVersion: 'tracking-v1' } }
        publish(id, { ...state, busy: true, message: 'Tracking saved. Sending email…' })
        await send(id, state)
      } catch (error) { publish(id, { message: `${error.message} Email not sent by this attempt.` }) }
      finally { busy.delete(id) }
    },
    async retry(id) {
      const state = states.get(id)
      if (busy.has(id) || !state?.retry) return
      busy.add(id)
      publish(id, { ...state, busy: true, message: 'Tracking saved. Checking notification before retry…' })
      try { await send(id, { ...state, busy: false }) } finally { busy.delete(id) }
    },
  }
}
