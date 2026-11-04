import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {runInNewContext} from 'node:vm'
const output=await build({entryPoints:['supabase/functions/referral-monthly/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'offline',setup(b){
 b.onResolve({filter:/https:|_shared\//},args=>({path:args.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:
 path.includes('/http/server')?'export const serve=fn=>h.handler=fn;':
 path.includes('supabase-js')?'export const createClient=()=>({});':
 path.includes('supabaseTransport')?'export const createApiClient=()=>h.db;':
 path.includes('supabaseKeys')?'export const getSupabaseSecretKey=()=>"fixture-only";':
 path.includes('storeAuthorization')?'export const authorizeStoreRequest=async(req,client,opts)=>{h.authCalls.push(opts);return h.authorized};':
 path.includes('referralStatements')?'export const runAutomaticStatements=async(db,opts)=>{h.options.push(opts);return h.result};':
 'export const observeEmailRun=async(db,name,work)=>{h.runs.push(name);return work()};'}))
}}]})
function harness(){const h={result:{sent:0,held:0,paid:0},authorized:true,authCalls:[],options:[],runs:[],db:{},env:{REFERRAL_AUTO_STATEMENTS_ENABLED:'true',REFERRAL_EMAILS_ENABLED:'true',RESEND_API_KEY:'fixture-only'}}
 const module={exports:{}};runInNewContext(output.outputFiles[0].text,{h,module,exports:module.exports,Response,Deno:{env:{get:name=>h.env[name]}}})
 h.request=(method='POST',body={})=>h.handler(new Request('http://fixture/referral-monthly',{method,...(method==='POST'?{body:JSON.stringify(body)}:{})}));return h}
test('actual endpoint rejects non-POST and unauthorized callers before monthly work',async()=>{
 const h=harness();assert.equal((await h.request('GET')).status,405);assert.equal(h.authCalls.length,0)
 h.authorized=false;assert.equal((await h.request()).status,403);assert.equal(h.options.length,0);assert.equal(h.runs.length,0)
})
test('actual endpoint cannot enable sends with request flags when environment gates are off',async()=>{
 for(const key of ['REFERRAL_AUTO_STATEMENTS_ENABLED','REFERRAL_EMAILS_ENABLED','RESEND_API_KEY']){
  const h=harness();h.env[key]='';assert.equal((await h.request('POST',{enabled:true,emailEnabled:true})).status,409);assert.equal(h.options.length,0)
 }
})
test('authorized worker ignores caller dates, recipient lists, payout flags and provider URLs',async()=>{
 const h=harness();const response=await h.request('POST',{date:'1900-01-01',recipients:['private@invalid.test'],paid:true,url:'https://wrong.invalid'})
 assert.equal(response.status,200);assert.equal((await response.json()).paid,0);assert.equal(h.runs[0],'referral-monthly')
 assert.equal(h.authCalls[0].allowCron,true);assert.deepEqual(Object.keys(h.options[0]).sort(),['apiKey','emailEnabled','enabled'])
 assert.ok(!JSON.stringify(h.options).includes('private@'));assert.ok(!JSON.stringify(h.options).includes('1900'))
})
test('actual endpoint reports a persistent review backlog even when no new send failed',async()=>{
 const h=harness();h.result={sent:0,held:0,review:1,paid:0}
 assert.equal((await (await h.request()).json()).failed,1)
})
