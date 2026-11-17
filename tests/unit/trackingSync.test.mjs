import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { statusText, parseUsps, parseUps, applyTrackingResult } from '../../supabase/functions/_shared/trackingSync.js'
const order = { id:'order',tracking_number:'1Z1234567890123456',tracking_carrier:'ups',status:'shipped',payment_status:'paid',created_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-02T12:00:00Z',tracking_last_checked_at:null,delivered_at:null }
const now = Date.parse('2026-11-08T00:00:00Z')
const ups = (description='Delivered', overrides={}) => ({ trackResponse:{shipment:[{package:[{trackingNumber:order.tracking_number,currentStatus:{description,type:'D'},activity:[{status:{type:'D'},date:'20261005'}],...overrides}]}]} })
test('delivery matching never uses arbitrary delivery substrings', () => {
 for (const s of ['Not delivered','Undelivered','Delivery Attempt','Available for pickup','Delivered to UPS Access Point','Delivery attempted','Returned to sender','Out for delivery']) assert.notEqual(statusText(s),'delivered',s)
 assert.equal(statusText('Delivered'),'delivered')
})
test('UPS requires matching package and a plausible actual event date', () => {
 assert.equal(parseUps(ups(),order,now).status,'delivered')
 assert.equal(parseUps(ups(),order,now).deliveredAt,null)
 for (const patch of [{trackingNumber:'OTHER'},{activity:[]},{activity:[{status:{type:'D'},date:'20251005'}]},{activity:[{status:{type:'D'},date:'20271205'}]}]) assert.equal(parseUps(ups('Delivered',patch),order,now).status,'lookup_failed')
 assert.equal(parseUps(ups('Not delivered'),order,now).status,'exception')
})
test('USPS explicit delivered category and matching dated event required', () => {
 const o = {...order, tracking_number:'9400000000000000000000',tracking_carrier:'usps'}
 const p = {trackingNumber:o.tracking_number,statusCategory:'Delivered',trackingEvents:[{eventType:'Delivered, In/At Mailbox',eventTimestamp:'2026-10-05T15:20:00-05:00'}]}
 assert.equal(parseUsps(p,o,now).deliveredAt,'2026-10-05T20:20:00.000Z')
 assert.equal(parseUsps({...p,trackingNumber:'wrong'},o,now).status,'lookup_failed')
 assert.notEqual(parseUsps({...p,statusCategory:'Delivery Attempt'},o,now).status,'delivered')
 assert.equal(parseUsps({...p,trackingEvents:[]},o,now).status,'lookup_failed')
})
test('updates guard concurrent refund/status/tracking/timestamp changes', async () => {
 const calls=[]; const query = new Proxy({}, {get:(_,method) => (...args) => {calls.push([method,...args]);return method==='select'?Promise.resolve({data:[{id:order.id}],error:null}):query}})
 await applyTrackingResult({from:() => query},order,{status:'delivered',deliveredAt:null},'2026-11-08T00:00:00Z')
 for (const guard of [['eq','status','shipped'],['eq','payment_status','paid'],['eq','tracking_number',order.tracking_number],['eq','tracking_carrier','ups'],['eq','updated_at',order.updated_at],['is','tracking_last_checked_at',null],['is','delivered_at',null]]) assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(guard)))
 assert.equal(calls[0][1].delivered_at,null)
})
test('existing delivery timestamps preserved and non-delivery does not change order status', async () => {
 let patch; const q = new Proxy({}, {get:(_,method)=>(...args)=>{if(method==='update')patch=args[0];return method==='select'?Promise.resolve({data:[]}):q}})
 await applyTrackingResult({from:()=>q},{...order,delivered_at:'2026-10-05T00:00:00Z'},{status:'delivered'},'2026-11-08T00:00:00Z')
 assert.equal(patch.delivered_at,'2026-10-05T00:00:00Z')
 await applyTrackingResult({from:()=>q},order,{status:'credentials_missing'},'2026-11-08T00:00:00Z')
 assert.deepEqual(Object.keys(patch).sort(),['tracking_last_checked_at','tracking_status'])
})
test('handler has no customer communication and is bounded/authenticated', () => {
 const code = readFileSync(new URL('../../supabase/functions/check-tracking-status/index.ts',import.meta.url),'utf8')
 assert.ok(!code.includes('functions.invoke'))
 assert.ok(!code.includes('send-delivery-email'))
 assert.match(code,/authorizeStoreRequest/)
 assert.match(code,/limit\(200\)/)
 assert.match(code,/AbortSignal.timeout\(10000\)/)
})

test('UPS accepts unpadded GMT time without inventing timezone', () => {
 const p = ups('Delivered',{activity:[{status:{type:'D'},gmtDate:'20261005',gmtTime:'74700',date:'20261005'}]})
 assert.equal(parseUps(p,order,now).deliveredAt,'2026-10-05T07:47:00.000Z')
 assert.notEqual(parseUps(ups('Delivered to UPS Access Point'),order,now).status,'delivered')
})
