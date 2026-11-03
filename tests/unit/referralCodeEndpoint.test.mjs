import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {runInNewContext} from 'node:vm'
const output=await build({entryPoints:['supabase/functions/referral-admin/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'offline',setup(b){
 b.onResolve({filter:/https:|_shared\//},args=>({path:args.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:
 path.includes('/http/server')?'export const serve=fn=>h.handler=fn;':path.includes('supabase-js')?'export const createClient=()=>({});':
 path.includes('supabaseTransport')?'export const createApiClient=()=>({auth:{getUser:async()=>({data:{user:h.user},error:null})}});':
 path.includes('supabaseKeys')?'export const getSupabaseSecretKey=()=>"fixture-only",getSupabasePublishableKey=()=>"fixture-public";':
 path.includes('storeAuthorization')?'export const isActiveAdmin=async()=>h.active;':
 path.includes('referralStatements')?'export const sendReferralStatement=()=>{throw Error("Unexpected email")};':
 path.includes('emailHealth')?'export const createEmailRecorder=()=>{throw Error("Unexpected email")},digest=()=>{};':
 'export const rpc=async(db,name,args)=>{h.calls.push({name,args});return {id:"created-fixture",code:args.p_generate?"DC-ABCDEFGH":args.p_code.trim().toUpperCase()}};'}))
}}]})
function harness(){const h={user:{id:'verified-owner'},active:true,calls:[]},module={exports:{}};runInNewContext(output.outputFiles[0].text,{h,module,exports:module.exports,Response,Deno:{env:{get:()=>''}}})
 h.create=data=>h.handler(new Request('http://fixture/referral-admin',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({action:'create',data})}));return h}
test('custom code creation uses verified actor and server-only create RPC without sending invitations',async()=>{
 const h=harness(),result=await h.create({email:'past@invalid.test',name:'Fixture',code:' custom-code ',p_actor:'forged'})
 assert.equal(result.status,200);assert.equal((await result.json()).code,'CUSTOM-CODE')
 assert.equal(h.calls[0].name,'referral_create_partner');assert.equal(h.calls[0].args.p_actor,'verified-owner');assert.equal(h.calls[0].args.p_generate,false)
})
test('generation mode requests atomic server collision handling and reports the final code',async()=>{
 const h=harness(),result=await h.create({email:'past@invalid.test',name:'Fixture',code:'DC-PREVIEW2',codeMode:'generated'})
 assert.equal((await result.json()).code,'DC-ABCDEFGH');assert.equal(h.calls[0].args.p_generate,true)
 const invalid=harness();assert.equal((await invalid.create({codeMode:'overwrite'})).status,400);assert.equal(invalid.calls.length,0)
})
test('ordinary/inactive callers cannot create custom or generated codes',async()=>{
 for(const inactive of [false,true]){const h=harness();if(inactive)h.active=false;else h.user=null
 assert.equal((await h.create({codeMode:'generated'})).status,403);assert.equal(h.calls.length,0)}
})
