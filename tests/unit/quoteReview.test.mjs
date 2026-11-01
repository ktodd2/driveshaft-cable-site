import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { quoteReview } from '../../src/lib/quoteReview.js'
import { readReviewSources, reviewSources } from '../../supabase/functions/_shared/quoteReview.js'
const quote = { id:1,email:' A@Example.test ',created_at:'2026-02-01',status:'new',message:'Please quote' }
const sources = () => ({ quotes:{rows:[quote]},orders:{rows:[]},sends:{rows:[]},preferences:{rows:[]} })
test('matches only normalized exact email, retains pre-quote and unpaid orders as possible evidence, deduplicates IDs', () => {
 const s=sources(); s.orders.rows=[{id:'one',email:'a@example.test',created_at:'2025-01-01',payment_status:'unpaid',status:'cancelled'},{id:'one',email:'a@example.test',created_at:'2025-01-01',payment_status:'unpaid',status:'cancelled'},{id:'two',email:'a+tag@example.test'}]
 const r=quoteReview(quote,s); assert.equal(r.orders.length,1); assert.match(r.events.find(e=>e.id==='order-one').text,/unpaid.*cancelled.*predates/); assert.match(r.nextAction,/Review possible order/)
 assert.equal(quote.status,'new'); assert.equal(quoteReview({...quote,email:''},s).orders.length,0)
})
test('campaign history is separate from personal reply and does not infer conversion', () => {
 const s=sources(); s.sends.rows=[{id:1,email:'a@example.test',sent_at:'2026-04-02',campaign_id:5,cycle:1},{id:2,email:'a@example.test',sent_at:'2026-04-01',campaign_id:5,cycle:0}]
 const r=quoteReview(quote,s); assert.equal(r.latestSend.id,1); assert.match(r.events[0].text,/delivery and reply unknown/); assert.match(r.nextAction,/Check your inbox/)
})
test('opt-out overrides next action; missing sources and closed statuses do not suggest outreach', () => {
 const s=sources(); s.preferences.rows=[{id:1,email:'a@example.test',status:'unsubscribed'}]; assert.match(quoteReview(quote,s).nextAction,/do not send/)
 s.preferences={error:true,rows:[]}; assert.match(quoteReview(quote,s).nextAction,/Refresh unavailable/)
 assert.match(quoteReview({...quote,status:'converted'},sources()).nextAction,/Closed quote/)
 assert.equal(quoteReview(quote,{}).incomplete,true)
})
test('source reads paginate; failed later pages discard partial history, other sources survive', async () => {
 const client={from(table){let start; const q={select:()=>q,order:()=>q,range:(a)=>{start=a;return q},then(fn){return Promise.resolve(table==='orders' ? start===0?{data:Array.from({length:500},(_,id)=>({id}))}:{error:Error('failed')} : {data:table==='quote_requests'?[quote]:[]}).then(fn)}};return q}}
 const result=await readReviewSources(client); assert.equal(result.orders.error,true); assert.deepEqual(result.orders.rows,[]); assert.equal(result.quotes.rows.length,1)
})
function endpoint({ tokenValid=true,active=true }={}) {
 let handler, reads=0, secretReads=0
 const source=readFileSync(new URL('../../supabase/functions/quote-contact-review/index.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'')
 runInNewContext(stripTypeScriptTypes(source),{serve:fn=>handler=fn,Response,Date,createClient:()=>{},Deno:{env:{get:()=> 'https://offline.test'}},getSupabasePublishableKey:()=> 'public-fixture',getSupabaseSecretKey:()=>{secretReads++;return 'secret-fixture'},createApiClient:()=>({auth:{getUser:async()=>({data:{user:tokenValid?{id:'admin'}:null}})}}),isActiveAdmin:async()=>active,readReviewSources:async()=>{reads++;return sources()}})
 return {call:handler,counts:()=>({reads,secretReads})}
}
test('endpoint denies anonymous, invalid user and inactive admin before privileged data access',async()=>{
 for(const scenario of [{noToken:true},{tokenValid:false},{active:false}]){
  const e=endpoint(scenario); const response=await e.call(new Request('https://offline.test',{method:'POST',headers:scenario.noToken?{}:{Authorization:'Bearer fixture'}})); assert.equal(response.status,401); assert.deepEqual(e.counts(),{reads:0,secretReads:0})
 }
})
test('active admin can read; repeated calls have no write path and responses cannot be cached',async()=>{
 const e=endpoint(); for(let i=0;i<2;i++){const response=await e.call(new Request('https://offline.test',{method:'POST',headers:{Authorization:'Bearer fixture'}})); assert.equal(response.status,200); assert.equal(response.headers.get('Cache-Control'),'no-store'); assert.equal((await response.json()).sources.quotes.rows.length,1)}
 assert.equal(e.counts().reads,2)
 const invalid=await e.call(new Request('https://offline.test')); assert.equal(invalid.status,405)
})

test('missing or invalid dates never assert that an order predates a quote', () => {
 const s=sources(); s.orders.rows=[{id:'undated',email:'a@example.test',created_at:null}]
 assert.doesNotMatch(quoteReview(quote,s).events.find(e=>e.id==='order-undated').text,/predates/)
 s.orders.rows[0].created_at='2026-01-01';assert.doesNotMatch(quoteReview({...quote,created_at:'invalid'},s).events.find(e=>e.id==='order-undated').text,/predates/)
})
test('review projections exclude private shipping/payment identifiers and subscriber tokens', () => {
 for(const [,fields] of Object.values(reviewSources)) {
  assert.doesNotMatch(fields,/\*|shipping_address|stripe_|token|html_content|phone|total_cents/)
 }
})
