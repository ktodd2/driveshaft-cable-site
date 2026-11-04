import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
function endpoint(check){
 let handler;const db={fixture:'private database client'}
 const source=readFileSync('supabase/functions/validate-discount-code/index.ts','utf8').replace(/^import .*\n/gm,'')
 runInNewContext(stripTypeScriptTypes(source),{serve:fn=>handler=fn,createApiClient:()=>db,createClient(){throw Error('No network allowed')},getSupabaseSecretKey:()=>'',checkDiscountCode:(code,email,client)=>{assert.equal(client,db);return check(code,email)},Deno:{env:{get:()=>''}},Response,JSON})
 return body=>handler(new Request('http://offline.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)}))
}
test('intentional public coupon endpoint needs no JWT and exposes only eligibility/percentage, not private helper fields',async()=>{
 const call=endpoint(async(code,email)=>{assert.equal(code,'WELCOME5');assert.equal(email,'buyer@invalid.test');return {valid:true,code:'WELCOME5',percentOff:5,privateField:'must not be exposed'}})
 const r=await call({code:'WELCOME5',email:'buyer@invalid.test'});assert.equal(r.status,200)
 assert.deepEqual(await r.json(),{valid:true,code:'WELCOME5',percentOff:5})
 const invalid=endpoint(async()=>({valid:false,reason:'Invalid discount code.'}));assert.deepEqual(await(await invalid({})).json(),{valid:false,reason:'Invalid discount code.'})
 const unavailable=endpoint(async()=>({valid:false,reason:'Could not verify code, please try again.',lookupFailed:true}));assert.equal((await unavailable({})).status,500)
})
test('public coupon exceptions and malformed JSON never expose underlying errors',async()=>{
 const call=endpoint(async()=>{throw Error('private fixture upstream diagnostic')})
 for(const body of [{code:'WELCOME5',email:'buyer@invalid.test'},'{not json']){
  const r=await call(body);assert.equal(r.status,400);assert.deepEqual(await r.json(),{valid:false,reason:'Validation failed. Please try again.'})
 }
})
