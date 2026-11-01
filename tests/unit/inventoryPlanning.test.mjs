import test from 'node:test'
import assert from 'node:assert/strict'
import { forecast, reconcileIncoming, incomingWarning, dateTime } from '../../src/lib/inventoryPlanning.js'
const now = new Date('2026-11-01T12:00:00Z')
const order = (id, patch={}) => ({ id,created_at:'2026-10-15T12:00:00Z',payment_status:'paid',status:'confirmed',items:[{productId:'1',quantity:30},{productId:'xl',quantity:3}],...patch })
const run = patch => forecast({orders:[order('a')],stock:10,productId:'1',days:30,leadDays:30,safetyDays:5,now,...patch})
const line = patch => ({reference:'PO-A',productId:'1',quantity:100,etaStart:'2026-12-01',etaEnd:'2026-12-16',receiptIds:[],...patch})
test('completed UTC days, exact variant units and reorder arithmetic',()=>{
 const f=run({}); assert.equal(f.units,30);assert.equal(f.runway,10);assert.equal(f.reorderPoint,35);assert.equal(f.status,'Reorder review needed');assert.equal(f.start,'2026-10-02');assert.equal(f.end,'2026-11-01')
 assert.equal(run({productId:'xl'}).units,3)
 assert.equal(run({orders:[order('a',{created_at:'2026-10-02T00:00:00Z'}),order('b',{created_at:'2026-11-01T00:00:00Z'}),order('c',{created_at:'2026-10-01T23:59:59Z'})]}).units,30)
})
test('exclude cancelled, draft, known tests, refunds, malformed dates; deduplicate orders',()=>{
 const patches=[{status:'cancelled'},{status:'pending'},{payment_status:'pending'},{is_test:true},{test_mode:true},{livemode:false},{refunded_at:'2026-10-16'},{refunded_amount_cents:1},{created_at:'bad'}]
 assert.equal(run({orders:[order('a'),order('a'),...patches.map((p,i)=>order(String(i),p))]}).units,30)
})
test('unknown, negative and zero stock; no sales is not infinite coverage',()=>{
 for(const stock of [null,undefined,'10',NaN])assert.equal(run({stock}).status,'Unknown stock')
 for(const stock of [-3,0]){assert.equal(run({stock}).runway,0);assert.match(run({stock}).status,/Out of stock/)}
 assert.equal(run({orders:[]}).runway,null);assert.equal(run({leadDays:null}).reorderPoint,null)
 assert.equal(run({leadDays:-1}).reorderPoint,null);assert.equal(run({leadDays:1.5}).reorderPoint,null)
})
test('low volume and malformed sales are disclosed',()=>{
 assert.equal(run({}).lowVolume,true)
 const f=run({orders:[order('a',{items:[{quantity:3},{productId:'1',quantity:-1}]})]});assert.equal(f.invalid,2);assert.equal(f.units,0)
})
test('partial and complete receipts do not add to on-hand',()=>{
 const receipts=[{id:'r',product_id:'1',quantity:40}]
 const [l]=reconcileIncoming([line({receiptIds:['r']})],receipts,now);assert.equal(l.remaining,60);assert.equal(l.received,40)
 assert.equal(reconcileIncoming([line({quantity:40,receiptIds:['r']})],receipts,now)[0].remaining,0)
 assert.match(incomingWarning(run({}),l),/run out/)
})
test('duplicate references and multiply-linked receipts fail closed',()=>{
 assert.ok(reconcileIncoming([line({}),line({reference:' po-a '})],[],now).every(l=>l.remaining===null))
 const receipt={id:'r',product_id:'1',quantity:10}
 assert.ok(reconcileIncoming([line({receiptIds:['r']}),line({reference:'B',receiptIds:['r']})],[receipt],now).every(l=>l.issue))
 for(const receipts of [[],[receipt,receipt],[{...receipt,product_id:'xl'}],[{...receipt,quantity:101}]])assert.ok(reconcileIncoming([line({receiptIds:['r']})],receipts,now)[0].issue)
})
test('unknown, late, invalid and boundary ETA handling',()=>{
 const get=p=>reconcileIncoming([line(p)],[],now)[0]
 assert.equal(get({etaStart:'',etaEnd:''}).status,'ETA unknown')
 assert.match(get({etaStart:'2026-10-01',etaEnd:'2026-10-31'}).status,/Overdue/)
 assert.equal(get({etaStart:'2026-11-01',etaEnd:'2026-11-01'}).daysToLatest,0)
 for(const etaEnd of ['2026-02-30','2026-99-99','2026-11-01'])assert.ok(get({etaEnd}).issue)
 assert.ok(Number.isNaN(dateTime('2026-99-99')))
})
