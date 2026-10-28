import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storefrontReady } from '../../scripts/storefront-readiness.mjs'
const good = { VITE_SUPABASE_URL: 'https://twrihhyfvomqiqbxkitc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_offline_fixture' }

test('build gate rejects missing, legacy, secret or wrong-project configuration without requests', async () => {
  for (const env of [{}, {...good,VITE_SUPABASE_PUBLISHABLE_KEY:'legacy-fixture'}, {...good,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_offline_fixture'}, {...good,VITE_SUPABASE_URL:'https://elsewhere.test'}]) {
    let calls=0
    assert.equal(await storefrontReady(env,async()=>{calls++;throw Error('forbidden')}),false)
    assert.equal(calls,0)
  }
})
test('build gate requests zero rows, never follows redirects, and accepts only successful API access', async () => {
  for (const status of [200,401,403,500]) {
    let cancelled=false
    const result=await storefrontReady(good,async(url,options)=>{
      assert.equal(url,'https://twrihhyfvomqiqbxkitc.supabase.co/rest/v1/products?select=id&limit=0')
      assert.equal(options.redirect,'error')
      assert.equal(options.headers.apikey,good.VITE_SUPABASE_PUBLISHABLE_KEY)
      assert.ok(options.signal)
      return {status,body:{cancel:async()=>{cancelled=true}}}
    })
    assert.equal(result,status===200);assert.equal(cancelled,true)
  }
})
test('build gate returns false without exposing transport errors', async()=>{
  assert.equal(await storefrontReady(good,async()=>{throw Error('sensitive upstream fixture')}),false)
})
