import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createEmailRecorder,observeEmailRun} from '../../supabase/functions/_shared/emailHealth.js'
import {memoryDb} from '../fixtures/emailHealthDb.mjs'
const options={headers:{},body:'PRIVATE BODY'}
test('persistent acceptance survives recorder reload, repeats and concurrent requests',async()=>{
 const db=memoryDb();let calls=0
 const provider=async()=>{calls++;return Response.json({id:'msg-1'})}
 const send=()=>createEmailRecorder(db,'test',null,provider).send('record',['recipient'], 'mock', options)
 await Promise.all([send(),send()]);await send();assert.equal(calls,1)
 assert.equal(db.tables.email_attempts[0].provider_id,'msg-1')
 assert.ok(!JSON.stringify(db.tables).includes('PRIVATE BODY'));assert.ok(!JSON.stringify(db.tables).includes('recipient'))
})
for(const mode of ['network','malformed','server','rejected'])test(`${mode} outcomes block silent resends`,async()=>{
 const db=memoryDb();let calls=0
 const provider=async()=>{calls++;if(mode==='network')throw Error('secret');return Response.json(mode==='malformed'?{}:{error:'private payload'},{status:mode==='server'?503:mode==='rejected'?422:200})}
 for(let i=0;i<2;i++)assert.equal((await createEmailRecorder(db,'test',null,provider).send('record',[],'mock',options)).status,409)
 assert.equal(calls,1);assert.equal(db.tables.email_attempts[0].status,mode==='rejected'?'rejected':'uncertain')
 assert.ok(!JSON.stringify(db.tables).includes('private payload'))
})
test('storage failure prevents provider call',async()=>{
 let calls=0;const db={from:()=>({insert:()=>({select:()=>({single:async()=>({error:{code:'storage'}})})})})}
 await assert.rejects(()=>createEmailRecorder(db,'test',null,async()=>calls++).send('r',[],'mock',options));assert.equal(calls,0)
})
test('runs retain actual empty, skipped, failed counts and never invent prior history',async()=>{
 const db=memoryDb()
 await observeEmailRun(db,'test',async()=>Response.json({sent:0,failed:0,considered:0}))
 await observeEmailRun(db,'test',async()=>Response.json({sent:0,failed:0,considered:3,skipped_recent_order:3}))
 await observeEmailRun(db,'test',async()=>Response.json({error:'private'},{status:500}))
 assert.equal(db.tables.automation_runs[0].status,'completed');assert.equal(db.tables.automation_runs[0].counts.eligible,0)
 assert.equal(db.tables.automation_runs[1].counts.skipped,3);assert.equal(db.tables.automation_runs[2].status,'failed')
 assert.ok(!JSON.stringify(db.tables).includes('private'))
})
test('uncaught execution failure is recorded as review',async()=>{
 const db=memoryDb();await observeEmailRun(db,'test',async()=>{throw Error('secret')});assert.equal(db.tables.automation_runs[0].status,'review')
})
test('acceptance followed by storage outage leaves pending and blocks retry',async()=>{
 const db=memoryDb();let calls=0
 const broken={from(table){const q=db.from(table);if(table==='email_attempts')q.update=()=>({eq:async()=>({error:{code:'offline'}})});return q}}
 await assert.rejects(()=>createEmailRecorder(broken,'test',null,async()=>{calls++;return Response.json({id:'accepted-but-not-saved'})}).send('record',[],'mock',options))
 assert.equal(db.tables.email_attempts[0].status,'pending')
 assert.equal((await createEmailRecorder(db,'test',null,async()=>calls++).send('record',[],'mock',options)).status,409)
 assert.equal(calls,1)
})
test('different tracking notification IDs for one saved revision cannot make concurrent duplicate sends',async()=>{
 const db=memoryDb();let calls=0
 const transport=async()=>{calls++;return Response.json({id:'msg'})}
 const send=key=>createEmailRecorder(db,'send-tracking-email-v2',null,transport).send('order',['revision','recipient','tracking'], 'mock',{...options,headers:{'Idempotency-Key':key}})
 await Promise.all([send('tracking/order/first'),send('tracking/order/second')]);await send('tracking/order/third');assert.equal(calls,1)
})
test('legacy tracking idempotency key survives first ledger call at cutover',async()=>{
 let key
 await createEmailRecorder(memoryDb(),'send-tracking-email-v2',null,async(url,o)=>{key=o.headers['Idempotency-Key'];return Response.json({id:'existing'})}).send('order',['rev'],'mock',{...options,headers:{'Idempotency-Key':'tracking/order/original'}})
 assert.equal(key,'tracking/order/original')
})

test('tracking with missing credentials requires review rather than healthy completion',async()=>{
 const db=memoryDb();await observeEmailRun(db,'check-tracking-status',async()=>Response.json({checked:149,delivered:0,errors:0,results:Array.from({length:149},()=>({status:'credentials_missing'}))}));
 assert.equal(db.tables.automation_runs[0].status,'review');assert.equal(db.tables.automation_runs[0].counts.credentials_missing,149);
})
