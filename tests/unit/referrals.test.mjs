import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {validateReferralRecovery,normalizeReferralEmail,referralRate,referralCommission,prepareReferralCheckout,handleReferralEvent,statementText} from '../../supabase/functions/_shared/referrals.js'
const snapshot={order_id:'fixture-order',email:'new@invalid.test',intent_id:null,created_at:'2026-11-01T00:00:00Z',expires_at:'2026-11-01T00:30:00Z',intent_params:{amount:9000}}
const now=Date.parse('2026-11-01T01:00:00Z')
test('tier math and email identity retain plus tags and Gmail dots',()=>{
 assert.deepEqual(Array.from({length:12},(_,i)=>referralRate(i+1)),[1000,500,200,200,200,200,200,200,200,200,100,100])
 assert.equal(normalizeReferralEmail(' A.B+Cable@Gmail.com '),'a.b+cable@gmail.com')
 assert.equal(referralCommission(9000,1000,1000),800,'discounted product base only')
 assert.equal(referralCommission(105,0,1000),11,'round to cents')
})
test('retry recovers the same provider intent and immutable parameters',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push([name,args]);return {data:snapshot}}}
 const stripe={paymentIntents:{create:async(...args)=>{calls.push(['create',args]);return{id:'pi_fixture',client_secret:'fixture'} }}}
 await prepareReferralCheckout(db,stripe,{},now);await prepareReferralCheckout(db,stripe,{},now)
 const creates=calls.filter(x=>x[0]==='create');assert.deepEqual(creates[0],creates[1]);assert.equal(creates[0][1][1].idempotencyKey,'referral-checkout/fixture-order')
})
test('independent checkouts never block another checkout or cancel payments',async()=>{
 let n=0;const created=[];const db={rpc:async name=>({data:name==='referral_prepare'?{...snapshot,order_id:'order-'+(++n)}:null})}
 const stripe={paymentIntents:{create:async(...args)=>{created.push(args);return{id:'pi_'+created.length}},cancel:async()=>assert.fail('must never cancel')}}
 await Promise.all([prepareReferralCheckout(db,stripe,{},now),prepareReferralCheckout(db,stripe,{},now)])
 assert.equal(created.length,2);assert.notEqual(created[0][1].idempotencyKey,created[1][1].idempotencyKey)
})
test('unknown payment beyond provider idempotency window cannot be recreated',async()=>{
 const db={rpc:async()=>({data:snapshot})}
 await assert.rejects(()=>prepareReferralCheckout(db,{}, {},now+24*3600000),/owner review/)
})
test('retrying a processing checkout does not cancel its payment',async()=>{
 const db={rpc:async()=>({data:{...snapshot,intent_id:'pi_old'}})}
 const stripe={paymentIntents:{retrieve:async()=>({id:'pi_old',status:'processing',client_secret:'fixture'}),cancel:async()=>assert.fail('must never cancel')}}
 assert.equal((await prepareReferralCheckout(db,stripe,{},now)).id,'pi_old')
})
const openRows=rows=>()=>({select(){return this},eq(){return this},in(){return this},limit:async()=>({data:rows})})
test('forged mutable order and test/unpaid/legacy intent never earn',async()=>{
 let writes=0;const db={rpc:async()=>{writes++;return {}}}
 for(const intent of [{livemode:false},{livemode:true,status:'processing'},{livemode:true,status:'succeeded',currency:'usd',metadata:{}}]){
  await handleReferralEvent(db,{paymentIntents:{retrieve:async()=>intent}},{livemode:true,type:'payment_intent.succeeded',data:{object:{id:'pi_fixture'}},created:10})
 }
 assert.equal(writes,0)
})
test('refund arriving before success reconciles verified payment first, then current cumulative charge',async()=>{
 const calls=[];const db={from:openRows([]),rpc:async(name,args)=>{calls.push([name,args]);return {}}}
 const intent={id:'pi_fixture',livemode:true,status:'succeeded',currency:'usd',metadata:{referral_system:'v1',order_id:'fixture-order'},receipt_email:' NEW@invalid.test ',amount:10000,amount_received:10000,latest_charge:{id:'ch_fixture',paid:true,created:1000,amount_refunded:2500,disputed:false}}
 const stripe={paymentIntents:{retrieve:async()=>intent}}
 await handleReferralEvent(db,stripe,{livemode:true,type:'charge.refunded',data:{object:{payment_intent:'pi_fixture'}},created:2000})
 assert.equal(calls[0][0],'referral_paid');assert.equal(calls[0][1].p_email,'new@invalid.test');assert.equal(calls[1][1].p_refunded,2500);assert.equal(calls[0][1].p_verified,false)
})
test('storage failure remains retryable; missing authoritative charge cannot award',async()=>{
 const intent={id:'pi_fixture',livemode:true,status:'succeeded',currency:'usd',metadata:{referral_system:'v1'},receipt_email:'new@invalid.test',amount:10000,amount_received:10000,latest_charge:{paid:false}}
 const event={livemode:true,type:'payment_intent.succeeded',data:{object:{id:'pi_fixture'}},created:1}
 await assert.rejects(()=>handleReferralEvent({}, {paymentIntents:{retrieve:async()=>intent}},event),/authoritative/)
 intent.latest_charge={paid:true,created:1};await assert.rejects(()=>handleReferralEvent({rpc:async()=>({error:{message:'offline'}})}, {paymentIntents:{retrieve:async()=>intent}},event),/offline/)
})
test('balance email is a statement and cannot claim a payment happened',()=>{
 const text=statementText({name:'Fixture',code:'CODE10'},{month:'2026-11',created_at:'2026-11-01T15:00:00Z',balance:{available:-100,pending:200,held:300,reserved:0,paid:500,reversed:100}})
 assert.match(text,/-\$1.00/);assert.match(text,/Reply to choose/);assert.match(text,/product shipping also comes from that reward balance/);assert.match(text,/No payment has been issued/)
})
test('invitation bearer is scrubbed before analytics loads',()=>{
 const shell=readFileSync('index.html','utf8');assert.ok(shell.indexOf('/referral-invite.js')<shell.indexOf('googletagmanager'))
 const window={location:{pathname:'/referral/signup',hash:'#fixture-secret'},history:{replaceState(...args){this.args=args}}}
 const document={createElement:()=>({}),head:{appendChild(){}}}
 runInNewContext(readFileSync('public/referral-invite.js','utf8'),{window,document})
 assert.equal(window.__referralInviteToken,'fixture-secret');assert.deepEqual(window.history.args.slice(1),['','/referral/signup'])
})

test('seven-day clock starts at signed payment success, not creation of a delayed charge',async()=>{
 const calls=[];const db={from:openRows([]),rpc:async(name,args)=>{calls.push([name,args]);return {}}}
 const intent={id:'pi_fixture',livemode:true,status:'succeeded',currency:'usd',metadata:{referral_system:'v1',order_id:'fixture-order'},receipt_email:'new@invalid.test',amount:10000,amount_received:10000,latest_charge:{paid:true,created:1000,amount_refunded:0}}
 await handleReferralEvent(db,{paymentIntents:{retrieve:async()=>intent}},{livemode:true,type:'payment_intent.succeeded',data:{object:{id:'pi_fixture'}},created:2000})
 assert.equal(calls[0][1].p_paid,new Date(2000000).toISOString());assert.equal(calls[0][1].p_verified,true)
})

test('lost response recovery requires original capability, amount, code and order fingerprint',()=>{
 const record={state:'prepared',total_cents:10000,intent_params:{metadata:{referral_checkout_hash:'hash',referral_order_hash:'order-hash',referral_code:'CODE10'}}}
 const input={amount:10000,orderHash:'order-hash',code:' code10 '}
 assert.equal(validateReferralRecovery(record,input,'hash'),true)
 for(const [data,hash] of [[input,'wrong'],[{...input,amount:9000},'hash'],[{...input,orderHash:'changed'},'hash'],[{...input,code:'OTHER'},'hash']])assert.equal(validateReferralRecovery(record,data,hash),false)
})
test('processing or abandoned competing payments only record observations; reconciliation never cancels them',async()=>{
 const calls=[];const db={from:openRows([{order_id:'other',intent_id:'pi_other',state:'prepared'}]),rpc:async(name,args)=>{calls.push([name,args]);return {}}}
 const current={id:'pi_fixture',livemode:true,status:'succeeded',currency:'usd',metadata:{referral_system:'v1',order_id:'fixture-order'},receipt_email:'new@invalid.test',amount:10000,amount_received:10000,latest_charge:{paid:true,created:1}}
 const stripe={paymentIntents:{retrieve:async id=>id==='pi_fixture'?current:{id,status:'processing'},cancel:async()=>assert.fail('must not cancel')}}
 await handleReferralEvent(db,stripe,{livemode:true,type:'payment_intent.succeeded',data:{object:{id:'pi_fixture'}},created:2})
 assert.ok(calls.some(([name,args])=>name==='referral_unpaid'&&args.p_order==='other'&&!args.p_cancelled));assert.equal(calls.at(-1)[0],'referral_reconcile')
})
