// Public validation endpoint only: does not record GA events and does not need a real secret.
import { createPurchaseSnapshot } from '../supabase/functions/_shared/purchaseAnalytics.js'
import { analyticsMetadata, queueEntry, measurementPayload, MEASUREMENT_ID } from '../supabase/functions/_shared/ga4Outbox.js'
const created = Math.floor(Date.now()/1000)
const intent = { id: 'pi_offlineFixture', client_secret: 'offlineFixture', status: 'succeeded', livemode: true, currency: 'usd', amount: 10100, amount_received: 10100,
 latest_charge: { paid: true, amount_refunded: 0, disputed: false }, metadata: {
 order_id: '00000000-0000-4000-8000-000000000001', ...analyticsMetadata({ allowed: true, client_id: '123.456', session_id: created - 60 }, true),
 ga4_purchase: createPurchaseSnapshot([{ productId: '1', quantity: 30, unitPrice: 270, analyticsName: 'Driveshaft Cable' }],8100,0,2000,0) } }
const row = queueEntry({ type: 'payment_intent.succeeded', livemode: true, created, data: { object: intent } })
const { payload } = measurementPayload(intent,row)
const response = await fetch(`https://www.google-analytics.com/debug/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=validation-only`, {
 method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ...payload, validation_behavior: 'ENFORCE_RECOMMENDATIONS' }), redirect: 'error', signal: AbortSignal.timeout(15000) })
if (!response.ok) throw new Error(`Validation HTTP ${response.status}`)
const result = await response.json()
console.log(JSON.stringify(result))
if (!Array.isArray(result.validationMessages) || result.validationMessages.length) process.exitCode = 1
