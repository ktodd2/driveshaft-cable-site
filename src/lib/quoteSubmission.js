// This ID is only an idempotency hint, never an authentication credential.
export function newQuoteSubmission() {
  const request_id = globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16)
    return (c === 'x' ? n : (n & 3) | 8).toString(16)
  })
  return { request_id, started_at: Date.now() }
}
