// Real PostgreSQL sessions over a private 0700 Unix socket, no TCP/hosted access.
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {AsyncLocalStorage} from 'node:async_hooks'
import assert from 'node:assert/strict'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {createSecurePayment,normalizeCheckoutInput,reconcileOrderPayment,cancelSecurePayment,resumeSecurePayment,checkoutDigest} from '../../supabase/functions/_shared/secureCheckout.js'
import {syncReferralIntent} from '../../supabase/functions/_shared/referrals.js'
const {default:pg}=await import(process.env.PG_MODULE||'pg')
const binaries=process.env.PG_BIN_DIR
if(!binaries)throw Error('Set PG_BIN_DIR to an approved local PostgreSQL 17 binary directory')
const root=await fs.mkdtemp('/tmp/referral-policy-pg-');await fs.chmod(root,0o700)
const socket=path.join(root,'socket'),data=path.join(root,'data');await fs.mkdir(socket,{mode:0o700})
const events=[],context=new AsyncLocalStorage();let server,control,a,b
const evidence={database:'PostgreSQL 17.6; temporary local synthetic database, private Unix socket; TCP disabled',provider_transport:'Synthetic deterministic fixture only; no Stripe requests, cryptographic signature validation or real deliveries',started_at:new Date().toISOString(),cases:events}
const record=(name,detail={})=>events.push({name,at:new Date().toISOString(),...detail})
async function command(binary,args){const p=spawn(path.join(binaries,binary),args,{stdio:['ignore','pipe','pipe']});let error='';p.stderr.on('data',chunk=>error+=chunk);const [code]=await once(p,'close');if(code)throw Error(binary+' failed: '+error.slice(-800))}
async function blocked(pid,name){
 const start=Date.now()
 while(Date.now()-start<5000){const result=await control.query('select wait_event_type,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1',[pid]);const row=result.rows[0];if(row?.wait_event_type==='Lock'&&row.blockers.length){record(name,{waiting_pid:pid,blockers:row.blockers,wait_event_type:row.wait_event_type});return}await new Promise(resolve=>setTimeout(resolve,20))}
 throw Error('Did not observe real lock contention: '+name)
}
try{
 await command('initdb',['-D',data,'-U',os.userInfo().username,'--auth-local=peer','--auth-host=reject','--encoding=UTF8','--no-locale'])
 server=spawn(path.join(binaries,'postgres'),['-D',data,'-h','','-k',socket,'-p','55439','-c','max_connections=10'],{stdio:['ignore','pipe','pipe']})
 await new Promise((resolve,reject)=>{let logs='';const timeout=setTimeout(()=>reject(Error('Local PostgreSQL startup timeout')),10000);server.stderr.on('data',chunk=>{logs+=chunk;if(logs.includes('ready to accept connections')){clearTimeout(timeout);resolve()}});server.once('error',reject);server.once('exit',code=>{clearTimeout(timeout);if(code)reject(Error('Local PostgreSQL exited before startup'))})})
 const connection={host:socket,port:55439,database:'postgres',user:os.userInfo().username}
 control=new pg.Client(connection);await control.connect()
 const adapter={exec:sql=>(context.getStore()||control).query(sql),query:(sql,args)=>(context.getStore()||control).query(sql,args),close:async()=>{}}
 const f=await commerceFixture({policyRuntime:true,sqlAdapter:adapter})
 await control.query('reset role');await control.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented) values('owner@invalid.test','Owner','paid','confirmed','cash','[]',100,true)");await control.query('set role service_role;update referral_settings set enabled=true')
 const partner=await f.db.rpc('referral_create_partner',{p_actor:f.owner,p_email:'owner@invalid.test',p_name:'Owner',p_code:'RACE-CODE',p_generate:false});assert.ifError(partner.error)
 await control.query("update referral_partners set status='active',accepted_at=now() where id=$1",[partner.data.id])
 a=new pg.Client(connection);b=new pg.Client(connection);await Promise.all([a.connect(),b.connect()]);await Promise.all([a.query('set role service_role'),b.query('set role service_role')])
 const pidB=(await b.query('select pg_backend_pid() pid')).rows[0].pid
 const request=(code='RACE-CODE')=>({checkoutId:crypto.randomUUID(),checkoutToken:'a'.repeat(64),customer:{email:'overlap@invalid.test',name:'Synthetic overlap buyer',address1:'123 Fixture Lane',city:'Houston',state:'TX',zip:'77001',country:'US'},items:[{productId:'1',quantity:10}],referralCode:code})
 const priced=async input=>({...input,amount:(await f.price(normalizeCheckoutInput(input))).totalCents})
 const create=input=>createSecurePayment(f.db,f.stripe,input,f.price,{referralEnabled:true})
 const first=await priced(request()),competing=await priced(request(null))
 await a.query('begin');record('first checkout transaction begins')
 const winner=await context.run(a,()=>create(first));assert.equal(winner.status,200)
 record('competing first checkout request starts')
 const loser=context.run(b,()=>create(competing)).then(result=>({result}),error=>({error:error.message}))
 await control.query('reset role');await blocked(pidB,'competing first checkout waits on email advisory lock')
 await a.query('commit');record('first checkout commits')
 assert.match((await loser).error,/unfinished first-order/);assert.equal(f.intents.size,1)
 record('competing checkout rejected; exactly one provider intent',{intent_count:f.intents.size})
 await control.query('set role service_role')
 const firstId=winner.body.clientSecret.split('_secret')[0],time=Math.floor(Date.now()/1000)+1
 f.succeed(firstId,time);await reconcileOrderPayment(f.db,f.stripe,f.intents.get(firstId));await syncReferralIntent(f.db,f.stripe,firstId,time,time)
 const second=await create(await priced(request(null))),third=await create(await priced(request(null)))
 const secondId=second.body.clientSecret.split('_secret')[0],thirdId=third.body.clientSecret.split('_secret')[0]
 f.succeed(secondId,time+30);f.succeed(thirdId,time+60)
 await reconcileOrderPayment(f.db,f.stripe,f.intents.get(secondId));await reconcileOrderPayment(f.db,f.stripe,f.intents.get(thirdId))
 await a.query('begin')
 await context.run(a,()=>syncReferralIntent(f.db,f.stripe,thirdId,time+60,time+60))
 record('later success delivery observed first; earlier trusted fixture timestamp still pending')
 const earlier=context.run(b,()=>syncReferralIntent(f.db,f.stripe,secondId,time+30,time+30)).then(()=>({ok:true}),error=>({error:error.message}))
 await control.query('reset role');await blocked(pidB,'overlapping simulated payment observation waits on email advisory lock')
 await a.query('commit');assert.deepEqual(await earlier,{ok:true})
 const rows=(await control.query('select sequence,rate_bps,order_id from referral_earnings order by sequence')).rows
 assert.deepEqual(rows.map(row=>[row.sequence,row.rate_bps]),[[1,1000],[2,500],[3,200]])
 assert.equal(rows[1].order_id,second.body.orderId);assert.equal(rows[2].order_id,third.body.orderId)
 record('reverse and overlapping observations settled by verified payment time',{sequences:rows.map(row=>({sequence:row.sequence,rate_bps:row.rate_bps}))})
 const tiers=[{through:20,bps:725}]
 await a.query('begin')
 await a.query('select referral_set_code_policy($1,$2,1,600,$3)',[f.owner,partner.data.id,JSON.stringify(tiers)])
 const stale=b.query('select referral_set_code_policy($1,$2,1,700,$3)',[f.owner,partner.data.id,JSON.stringify(tiers)]).then(()=>({ok:true}),error=>({error:error.message}))
 await blocked(pidB,'simultaneous admin edit waits on partner row lock');await a.query('commit');assert.match((await stale).error,/settings changed/)
 assert.equal((await control.query('select count(*)::int n from referral_policy_versions where partner_id=$1',[partner.data.id])).rows[0].n,2)
 record('exactly one edit commits; stale edit rejected and history immutable')
 const preEdit=await priced(request(null));await a.query('begin');const frozen=await context.run(a,()=>create(preEdit))
 const edit=b.query('select referral_set_code_policy($1,$2,2,800,$3)',[f.owner,partner.data.id,JSON.stringify([{through:20,bps:900}])]).then(()=>({ok:true}),error=>({error:error.message}))
 await blocked(pidB,'policy edit waits for already prepared checkout terms');await a.query('commit');assert.deepEqual(await edit,{ok:true})
 const frozenPolicy=(await control.query('select policy_snapshot from referral_checkouts where order_id=$1',[frozen.body.orderId])).rows[0].policy_snapshot
 assert.equal(frozenPolicy.revision,2);assert.equal(frozenPolicy.tiers[0].bps,725)
 record('prepared order terms retained across concurrent edit',{prepared_revision:frozenPolicy.revision,current_revision:3})
 const cancelInput=request();cancelInput.customer.email='cancel-overlap@invalid.test'
 const preparedInput=await priced(cancelInput)
 await a.query('begin');const cancelTarget=await context.run(a,()=>create(preparedInput))
 const waitingCancel=context.run(b,()=>cancelSecurePayment(f.db,f.stripe,preparedInput)).then(result=>({result}),error=>({error:error.message}))
 await blocked(pidB,'cancellation waits for in-flight prepare ID lock without lock-order reversal')
 await a.query('commit');assert.equal((await waitingCancel).result.body.status,'cancelled')
 assert.equal(f.intents.get(cancelTarget.body.clientSecret.split('_secret')[0]).status,'canceled')
 record('prepare-then-cancel completed without deadlock; simulated provider cancellation verified')
 const beforeCount=f.intents.size,tombstoneInput=request();tombstoneInput.customer.email='tombstone-overlap@invalid.test'
 const pendingInput=await priced(tombstoneInput)
 await a.query('begin');await context.run(a,()=>cancelSecurePayment(f.db,f.stripe,pendingInput))
 const pendingCreate=context.run(b,()=>create(pendingInput)).then(result=>({result}),error=>({error:error.message}))
 await blocked(pidB,'prepare waits for earlier cancellation tombstone ID lock')
 await a.query('commit');assert.match((await pendingCreate).error,/cancelled or cancellation is pending/)
 assert.equal(f.intents.size,beforeCount)
 record('cancel-then-prepare rejected after tombstone commits; no orphan intent')
 // Ownership migration is added after existing prepared claims: those private
 // capabilities remain recoverable, while every new first claim requires proof.
 await control.query('reset role');await control.query(await fs.readFile('supabase/migrations/20261103145323_buyer_email_verification.sql','utf8'));await control.query('set role service_role;update referral_settings set buyer_verification_emails_enabled=true')
 assert.equal((await resumeSecurePayment(f.db,f.stripe,preEdit)).body.orderId,frozen.body.orderId)
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
 const prepareLink=async email=>{const raw=random(),id=crypto.randomUUID();const r=await f.db.rpc('buyer_verification_prepare',{p_id:id,p_email:email,p_link_hash:await checkoutDigest(raw),p_challenge_hash:await checkoutDigest(random())});assert.ifError(r.error);assert.equal(r.data,true);return {raw,id}}
 const consumed=await prepareLink('receiver-race@invalid.test'),hashA=await checkoutDigest(random()),hashB=await checkoutDigest(random())
 await a.query('begin');const firstConsume=await a.query('select buyer_verification_consume($1,$2) result',[await checkoutDigest(consumed.raw),hashA])
 const secondConsume=b.query('select buyer_verification_consume($1,$2) result',[await checkoutDigest(consumed.raw),hashB]).then(result=>({result}),error=>({error:error.message}))
 await control.query('reset role');await blocked(pidB,'different receiver proof waits on the single-use link row');await a.query('commit');assert.match((await secondConsume).error,/unavailable/)
 const retried=await b.query('select buyer_verification_consume($1,$2) result',[await checkoutDigest(consumed.raw),hashA]);assert.deepEqual(retried.rows[0].result,firstConsume.rows[0].result)
 record('one receiver proof issued; same-pair lost-response retry recovers without renewing expiry')
 await control.query('set role service_role')
 const expiryEmail='proof-expiry-lock@invalid.test',expiryLink=await prepareLink(expiryEmail),rawProof=random(),proofHash=await checkoutDigest(rawProof)
 await control.query('select buyer_verification_consume($1,$2)',[await checkoutDigest(expiryLink.raw),proofHash]);await control.query("update buyer_verification_proofs set expires_at=clock_timestamp()+interval '200 milliseconds' where token_hash=$1",[proofHash])
 const expiresInput=request();expiresInput.customer.email=expiryEmail;expiresInput.buyerVerificationToken=rawProof;const expiresPriced=await priced(expiresInput),beforeExpiry=f.intents.size
 await a.query('begin');await a.query('select pg_advisory_xact_lock(hashtextextended($1,7221))',[expiryEmail])
 const waitingExpiry=context.run(b,()=>create(expiresPriced)).then(result=>({result}),error=>({error:error.message}))
 await control.query('reset role');await blocked(pidB,'new first checkout waits while its ownership proof expires');await control.query('select pg_sleep(0.3)');await a.query('commit')
 assert.match((await waitingExpiry).error,/Email verification required/);assert.equal(f.intents.size,beforeExpiry)
 record('server clock rechecked after email lock; expired proof reserves nothing')
 await control.query('set role service_role');const oldLink=await prepareLink('link-expiry-lock@invalid.test')
 await control.query("update buyer_verification_requests set expires_at=clock_timestamp()+interval '200 milliseconds' where id=$1",[oldLink.id]);await a.query('begin');await a.query('select id from buyer_verification_requests where id=$1 for update',[oldLink.id])
 const waitingLink=b.query('select buyer_verification_consume($1,$2)',[await checkoutDigest(oldLink.raw),await checkoutDigest(random())]).then(()=>({ok:true}),error=>({error:error.message}))
 await control.query('reset role');await blocked(pidB,'link confirmation waits while the link expires');await control.query('select pg_sleep(0.3)');await a.query('commit');assert.match((await waitingLink).error,/unavailable/)
 record('server clock rechecked after link lock; no proof minted for expired link')
 await control.query('set role service_role');await a.query('begin')
 const budgetEmail='concurrent-mail-budget@invalid.test'
 const winnerMail=await a.query('select buyer_verification_prepare($1,$2,$3,$4) result',[crypto.randomUUID(),budgetEmail,await checkoutDigest(random()),await checkoutDigest(random())]);assert.equal(winnerMail.rows[0].result,true)
 const budgetLoser=b.query('select buyer_verification_prepare($1,$2,$3,$4) result',[crypto.randomUUID(),budgetEmail,await checkoutDigest(random()),await checkoutDigest(random())]).then(result=>({result}),error=>({error:error.message}))
 await control.query('reset role');await blocked(pidB,'concurrent mail request waits on the shared send-budget lock');await a.query('commit');assert.equal((await budgetLoser).result.rows[0].result,false)
 record('concurrent request budget permits one request; no email transport or proof granted')
 evidence.completed_at=new Date().toISOString();evidence.result='PASS'
 await fs.mkdir('docs/referrals',{recursive:true});await fs.writeFile('docs/referrals/concurrency-v2-local.json',JSON.stringify(evidence,null,2)+'\n')
 console.log('PASS actual PostgreSQL overlapping sessions: competing first checkout, reverse signed observations, simultaneous admin edits and prepare/edit lock contention; synthetic provider transport only.')
}finally{
 for(const client of [a,b,control])if(client){await client.query('rollback').catch(()=>{});await client.end().catch(()=>{})}
 if(server&&server.exitCode===null){server.kill('SIGINT');await once(server,'exit')}
 assert.ok(root.startsWith('/tmp/referral-policy-pg-'));await fs.rm(root,{recursive:true,force:true})
}
