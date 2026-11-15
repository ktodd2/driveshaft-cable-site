import test from 'node:test'
import assert from 'node:assert/strict'
import {createQuoteHandler} from '../../supabase/functions/_shared/quoteSubmission.js'
const input={name:'Jane Smith',email:'jane@gmail.com',company:'',phone:'',quantity:null,message:'Please quote XL.',website:'',request_id:'a1111111-1111-4111-8111-111111111111'}
function setup(saved={quote_id:42,notify:true}, opts={}) {
 const updates=[],calls=[];let sends=0
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:saved,error:opts.rpcError}},from:()=>({update:value=>{updates.push(value);const chain={eq:()=>chain,select:async()=>({data:opts.claimEmpty?[]:[{quote_id:42}]})};chain.then=(resolve)=>Promise.resolve({error:null}).then(resolve);return chain}})}
 const handler=createQuoteHandler({env:{get:k=>k==='SUPABASE_URL'?'https://example.supabase.co':k==='RESEND_API_KEY'?'resend-test':null},secretKey:()=> 'secret',publishableKey:()=> 'public',createDb:()=>db,fetcher:async()=>{sends++;if(opts.uncertain) throw Error('timeout');return Response.json({id:'provider-42'})}})
 const request=(patch={},key='public')=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Origin:'https://driveshaftcable.com'},body:JSON.stringify({...input,...patch})})
 return {handler,request,updates,calls,sends:()=>sends}
}
test('accepted quote persists before a single claimed notification',async()=>{const x=setup();const res=await x.handler(x.request());assert.equal(res.status,200);assert.equal(x.calls.length,1);assert.equal(x.sends(),1);assert.deepEqual(x.updates.map(x=>x.notification_state),['sending','sent'])})
test('quarantine and dedup do not notify',async()=>{for(const saved of [{quote_id:42,notify:false},{duplicate:true}]){const x=setup(saved);await x.handler(x.request({website:'bot'}));assert.equal(x.sends(),0);assert.ok(x.calls[0].args.p_reasons.includes('honeypot'))}})
test('pending duplicate safely recovers but losing CAS cannot send',async()=>{for(const empty of [true,false]){const x=setup({quote_id:42,notify:true,duplicate:true},{claimEmpty:empty});await x.handler(x.request());assert.equal(x.sends(),empty?0:1)}})
test('uncertain provider outcome saved as unknown, never reported unsaved',async()=>{const x=setup(undefined,{uncertain:true});assert.equal((await x.handler(x.request())).status,200);assert.equal(x.updates.at(-1).notification_state,'unknown')})
test('validation and API key errors never reach database',async()=>{const x=setup();assert.equal((await x.handler(x.request({},'wrong'))).status,401);assert.equal((await x.handler(x.request({email:'bad'}))).status,400);assert.equal(x.calls.length,0)})
test('rate limits, conflicts and storage errors are not false success',async()=>{for(const [saved,opts,status]of [[{limited:true},{},429],[{conflict:true},{},409],[null,{rpcError:true},503]]){const x=setup(saved,opts);assert.equal((await x.handler(x.request())).status,status);assert.equal(x.sends(),0)}})
