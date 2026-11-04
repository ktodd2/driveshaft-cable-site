import {test} from 'node:test'
import assert from 'node:assert/strict'
import {runAutomaticStatements,sendReferralStatement} from '../../supabase/functions/_shared/referralStatements.js'
import {statementDb} from '../fixtures/referralStatementDb.mjs'
const enabled={enabled:true,emailEnabled:true,apiKey:'fixture-only',wait:async()=>{}}
const accepted=()=>Response.json({id:'provider-fixture'})
test('automatic and manual delivery remain off by default before any DB/provider action',async()=>{
 const bad={rpc(){assert.fail('must not use DB')},from(){assert.fail('must not use DB')}}
 assert.equal((await runAutomaticStatements(bad)).disabled,true)
 assert.equal((await sendReferralStatement(bad,'fixture')).status,409)
 for(const flags of [{enabled:false},{emailEnabled:false},{apiKey:''}])assert.equal((await runAutomaticStatements(bad,{...enabled,...flags})).disabled,true)
})
test('database disable and missing activation date prevent an automatic run',async()=>{
 for(const field of ['emails_enabled','auto_statements_enabled','statements_started_at']){
  const db=statementDb();db.tables.referral_settings[0][field]=null
  const result=await runAutomaticStatements(db,{...enabled,transport:()=>assert.fail('must not send')})
  assert.equal(result.skipped,true);assert.equal(db.tables.email_attempts.length,0)
 }
})
test('zero/negative/positive balance statements use frozen recipients and omit buyer contact/payment fields and never pay rewards',async()=>{
 const db=statementDb(),messages=[]
 for(const row of db.tables.referral_statements)row.email='PRIVATE_BUYER@invalid.test'
 const result=await runAutomaticStatements(db,{...enabled,transport:async(url,options)=>{messages.push(JSON.parse(options.body));assert.match(options.headers['Idempotency-Key'],/^ledger\//);return accepted()}})
 assert.equal(result.sent,3);assert.equal(result.paid,0);assert.equal(result.more,false)
 assert.deepEqual(messages.map(m=>m.to),db.tables.referral_statements.map(s=>s.recipient_email))
 assert.match(messages[0].text,/Available rewards: \$0.00/);assert.match(messages[1].text,/Available rewards: -\$1.00/)
 assert.ok(messages.every(m=>m.text.includes('Balance prepared 2026-11-03T15:00:00.000Z (UTC)')))
 assert.ok(!JSON.stringify(messages).includes('PRIVATE_BUYER'));assert.ok(!JSON.stringify(db.tables.email_attempts).includes('Frozen Name'))
 assert.ok(db.calls.every(([name])=>!name.includes('redemption')&&!name.includes('approve')))
})
test('manual and scheduled delivery race shares one durable claim and provider key',async()=>{
 const db=statementDb(1);let calls=0;const transport=async()=>{calls++;return accepted()}
 await Promise.all([runAutomaticStatements(db,{...enabled,transport}),sendReferralStatement(db,'statement-001',{...enabled,transport})])
 await sendReferralStatement(db,'statement-001',{...enabled,transport})
 await runAutomaticStatements(db,{...enabled,transport})
 assert.equal(calls,1);assert.equal(db.tables.email_attempts.length,1);assert.equal(db.tables.email_attempts[0].automation,'referral-send-statement')
})
test('concurrent automatic runs are leased, with ledger dedupe as a second line of protection',async()=>{
 const db=statementDb(3);let calls=0;const transport=async()=>{calls++;return accepted()}
 const results=await Promise.all([runAutomaticStatements(db,{...enabled,transport}),runAutomaticStatements(db,{...enabled,transport})])
 assert.equal(results.filter(x=>x.skipped).length,1);assert.equal(calls,3);assert.equal(db.lease,null)
})
test('bounded batches resume through the durable unclaimed queue without repeated sends',async()=>{
 const db=statementDb(7);let calls=0;const options={...enabled,batchSize:2,transport:async()=>{calls++;return accepted()}}
 for(let run=0;run<4;run++){const result=await runAutomaticStatements(db,options);assert.equal(result.more,run<3);assert.equal(result.paid,0)}
 assert.equal(calls,7);assert.equal(db.tables.email_attempts.length,7)
})
test('held first-page rows cannot starve later untouched statements',async()=>{
 const db=statementDb(51)
 for(const s of db.tables.referral_statements.slice(0,50))db.tables.email_attempts.push({id:s.id,automation:'referral-send-statement',entity_id:s.id,status:'uncertain'})
 let calls=0;const result=await runAutomaticStatements(db,{...enabled,batchSize:1,transport:async()=>{calls++;return accepted()}})
 assert.equal(result.sent,1);assert.equal(result.review,50);assert.equal(calls,1)
})
for(const mode of ['network','malformed','429','rejected'])test(`${mode} outcome is held across automatic/manual retries and old provider windows`,async()=>{
 const db=statementDb(1);let calls=0
 const transport=async()=>{calls++;if(mode==='network')throw Error('PRIVATE PROVIDER DETAIL');return Response.json(mode==='malformed'?{}:{error:'PRIVATE PROVIDER DETAIL'},{status:mode==='429'?429:mode==='rejected'?422:200})}
 const first=await runAutomaticStatements(db,{...enabled,transport});assert.equal(first.held,1)
 await runAutomaticStatements(db,{...enabled,clock:()=>Date.now()+3*86400000,transport})
 assert.equal((await sendReferralStatement(db,'statement-001',{...enabled,transport})).status,409)
 assert.equal(calls,1);assert.ok(!JSON.stringify(db.tables.email_attempts).includes('PRIVATE PROVIDER'))
})
test('provider acceptance followed by storage failure remains pending and is not resent',async()=>{
 const db=statementDb(2),original=db.from.bind(db);let broken=true,calls=0
 db.from=table=>{const q=original(table);if(table==='email_attempts'&&broken)q.update=()=>({eq:async()=>({error:{code:'offline'}})});return q}
 const transport=async()=>{calls++;return accepted()}
 await assert.rejects(()=>runAutomaticStatements(db,{...enabled,transport}),/review/)
 assert.equal(db.tables.email_attempts[0].status,'pending');assert.equal(db.lease,null)
 broken=false;const next=await runAutomaticStatements(db,{...enabled,transport});assert.equal(next.sent,1);assert.equal(next.review,1);assert.equal(calls,2)
})
test('email ledger outage fails before provider traffic and leaves future work untouched',async()=>{
 const db=statementDb(2),original=db.from.bind(db)
 db.from=table=>table==='email_attempts'?{insert:()=>({select:()=>({single:async()=>({error:{code:'offline'}})})})}:original(table)
 await assert.rejects(()=>runAutomaticStatements(db,{...enabled,transport:()=>assert.fail('must not send')}),/review/)
 assert.equal(db.tables.email_attempts.length,0);assert.equal(db.lease,null)
})
test('runtime budget leaves a durable continuation instead of consuming the entire queue',async()=>{
 const db=statementDb(10);let time=0,calls=0
 const result=await runAutomaticStatements(db,{...enabled,budgetMs:1000,clock:()=>time,wait:async ms=>{time+=ms},transport:async()=>{calls++;time+=100;return accepted()}})
 assert.ok(calls<10);assert.equal(result.more,true);assert.equal(result.remaining,10-calls)
})
test('switching automatic delivery off mid-batch stops subsequent sends without consuming them',async()=>{
 const db=statementDb(3);let calls=0
 const result=await runAutomaticStatements(db,{...enabled,transport:async()=>{calls++;db.tables.referral_settings[0].auto_statements_enabled=false;return accepted()}})
 assert.equal(result.paused,true);assert.equal(calls,1);assert.equal(db.tables.email_attempts.length,1)
 db.tables.referral_settings[0].auto_statements_enabled=true
 assert.equal((await runAutomaticStatements(db,{...enabled,transport:async()=>{calls++;return accepted()}})).sent,2)
})
test('unresolved provider outcomes remain in persisted review counts on later empty runs',async()=>{
 const db=statementDb(1),transport=async()=>{throw Error('network')}
 const first=await runAutomaticStatements(db,{...enabled,transport});assert.equal(first.review,1)
 const second=await runAutomaticStatements(db,{...enabled,transport});assert.equal(second.held,0);assert.equal(second.review,1)
 assert.equal(db.lastCounts.review,1)
 const last=db.calls.filter(([name])=>name==='referral_finish_statement_run').at(-1)
 assert.equal(last[1].p_failed,true)
})
