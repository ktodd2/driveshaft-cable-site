import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {runInNewContext} from 'node:vm'
import {referralInvitationOrigin} from '../../supabase/functions/_shared/referralInviteOrigin.js'
const live='https://twrihhyfvomqiqbxkitc.supabase.co',stage='https://dsc-referral-stage-20261103.onrender.com'
const fixtureRef='abcdefghijklmnopqrst',stageBackend=`https://${fixtureRef}.supabase.co`
const configured={SUPABASE_URL:stageBackend,REFERRAL_INVITE_STAGING_PROJECT_REF:fixtureRef,REFERRAL_INVITE_ORIGIN:stage}
const environment=values=>({get:key=>values[key]})
test('production keeps its fixed live origin and refuses staging configuration',()=>{
 assert.equal(referralInvitationOrigin(environment({SUPABASE_URL:live})),'https://driveshaftcable.com')
 for(const settings of [{REFERRAL_INVITE_ORIGIN:stage},{REFERRAL_INVITE_ORIGIN:'https://driveshaftcable.com'},{REFERRAL_INVITE_STAGING_PROJECT_REF:fixtureRef}])assert.throws(()=>referralInvitationOrigin(environment({SUPABASE_URL:live,...settings})),/not configured/)
})
test('staging requires an exact server-configured project and the fixed approved HTTPS host',()=>{
 assert.equal(referralInvitationOrigin(environment(configured)),stage)
 for(const values of [{},{SUPABASE_URL:stageBackend},{...configured,REFERRAL_INVITE_STAGING_PROJECT_REF:undefined},{...configured,REFERRAL_INVITE_STAGING_PROJECT_REF:'otherprojectabcdefgh'},{...configured,SUPABASE_URL:'https://unknownprojectabcdef.supabase.co'},{...configured,SUPABASE_URL:live},{...configured,SUPABASE_URL:stageBackend+'/'},{...configured,SUPABASE_URL:stageBackend+'?token=private'}])assert.throws(()=>referralInvitationOrigin(environment(values)),/not configured/)
})
test('arbitrary origins, credentials, ports, paths, query, fragment and encoded tricks fail closed',()=>{
 for(const origin of [undefined,'','https://evil.invalid',stage+'.evil.invalid','http://dsc-referral-stage-20261103.onrender.com','//dsc-referral-stage-20261103.onrender.com','javascript:alert(1)',stage+'/',stage+'/path',stage+'?next=evil',stage+'#fragment',stage+':443','https://user:pass@dsc-referral-stage-20261103.onrender.com','https://dsc-referral-stage-20261103.onrender.com@evil.invalid','https://dsc-referral-stage-20261103%2eonrender.com',stage+'\n'])assert.throws(()=>referralInvitationOrigin(environment({...configured,REFERRAL_INVITE_ORIGIN:origin})),/not configured/)
})

const output=await build({entryPoints:['supabase/functions/referral-admin/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'offline',setup(b){
 b.onResolve({filter:/https:|_shared\//},args=>args.path.endsWith('/referralInviteOrigin.js')?undefined:({path:args.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:
 path.includes('stripe@')?'export default class Stripe{};':path.includes('secureCheckout')?'export const cancelSecurePayment=()=>{throw Error("Unexpected payment cancellation")};':path.includes('/http/server')?'export const serve=fn=>h.handler=fn;':path.includes('supabase-js')?'export const createClient=()=>({});':
 path.includes('supabaseTransport')?'export const createApiClient=()=>({auth:{getUser:async()=>({data:{user:{id:"verified-owner"}},error:null})},from:table=>({select:()=>({single:async()=>({data:{emails_enabled:true},error:null}),eq:()=>({single:async()=>({data:{id:"partner-fixture",name:"Staging Referrer",email:"capture@invalid.test"},error:null})})})})});':
 path.includes('supabaseKeys')?'export const getSupabaseSecretKey=()=>"fixture-only",getSupabasePublishableKey=()=>"fixture-public";':
 path.includes('storeAuthorization')?'export const isActiveAdmin=async()=>true;':
 path.includes('referralStatements')?'export const sendReferralStatement=()=>{throw Error("Unexpected statement")};':
 path.includes('emailHealth')?'export const digest=async()=>"fixture-hash",createEmailRecorder=()=>({send:async(entity,identity,url,options)=>{h.sends.push(JSON.parse(options.body));return new Response(JSON.stringify({id:"captured-only"}),{status:200})}});':
 'export const rpc=async(db,name,args)=>{h.mutations.push({name,args});return {id:"invite-fixture"}};'}))
}}]})
function harness(values){
 const h={sends:[],mutations:[],tokenGenerations:0},module={exports:{}}
 runInNewContext(output.outputFiles[0].text,{h,module,exports:module.exports,Response,Deno:{env:environment({REFERRAL_EMAILS_ENABLED:'true',RESEND_API_KEY:'fixture-only',...values})},crypto:{getRandomValues(bytes){h.tokenGenerations++;bytes.fill(42);return bytes}}})
 h.invite=()=>h.handler(new Request('https://fixture.invalid/referral-admin',{method:'POST',headers:{Authorization:'Bearer fixture',Origin:'https://evil.invalid'},body:JSON.stringify({action:'send-invite',data:{partner_id:'partner-fixture',origin:'https://evil.invalid',siteUrl:'https://evil.invalid'}})}));return h
}
test('actual invite endpoint uses approved staging link and ignores caller-supplied origins',async()=>{
 const h=harness(configured),response=await h.invite();assert.equal(response.status,200);assert.equal(h.mutations.length,1);assert.equal(h.sends.length,1)
 const link=h.sends[0].text.match(/https:\/\/\S+/)[0],parsed=new URL(link)
 assert.equal(parsed.origin,stage);assert.equal(parsed.pathname,'/referral/signup');assert.equal(parsed.search,'');assert.match(parsed.hash,/^#[a-f0-9]{64}$/)
 assert.ok(!h.sends[0].text.includes('evil.invalid'));assert.ok(!h.sends[0].text.includes('driveshaftcable.com/referral/signup'))
 assert.equal(h.mutations[0].args.p_actor,'verified-owner');assert.equal(h.mutations[0].args.p_data.hash,'fixture-hash');assert.equal(h.tokenGenerations,1)
})
test('actual production invitation retains fixed production signup link',async()=>{
 const h=harness({SUPABASE_URL:live}),response=await h.invite();assert.equal(response.status,200)
 assert.match(h.sends[0].text,/https:\/\/driveshaftcable\.com\/referral\/signup#[a-f0-9]{64}/)
})
test('misconfigured staging or production cannot generate a token, create an invitation or send',async()=>{
 for(const values of [{SUPABASE_URL:stageBackend},{...configured,REFERRAL_INVITE_ORIGIN:stage+'?tracking=1'},{...configured,SUPABASE_URL:live}]){
  const h=harness(values),response=await h.invite();assert.equal(response.status,409);assert.equal(h.tokenGenerations,0);assert.equal(h.mutations.length,0);assert.equal(h.sends.length,0)
  assert.equal((await response.json()).error,'Referral invitation origin is not configured for this environment')
 }
})
