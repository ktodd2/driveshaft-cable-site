import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { isActiveAdmin } from '../../supabase/functions/_shared/storeAuthorization.js'

test('admin authority is an active matching database row, never user claims', async () => {
  for (const scenario of ['active', 'inactive', 'missing', 'wrong-id', 'db-error']) {
    const filters = []
    const chain = { select: () => chain, eq: (field, value) => { filters.push([field,value]); return chain },
      maybeSingle: async () => ({ data: scenario === 'active' ? { id: 'user-fixture' } : scenario === 'wrong-id' ? { id: 'other' } : null, error: scenario === 'db-error' ? Error('offline') : null }) }
    const result = await isActiveAdmin({ from: table => { assert.equal(table,'admin_users'); return chain } }, 'user-fixture')
    assert.equal(result, scenario === 'active')
    assert.deepEqual(filters, [['id','user-fixture'],['is_active',true]])
  }
  assert.equal(await isActiveAdmin({ from() { throw Error('unavailable') } }, 'user-fixture'), false)
})

function authorizer({ backend = false, cron, tokenValid = false, active = false, authError = false } = {}) {
  const source = readFileSync(new URL('../../supabase/functions/_shared/storeAuthorization.js', import.meta.url),'utf8')
    .replace(/^import .*\n/gm,'').replace(/^export /gm,'')
  const context = {
    getSupabaseSecretKey: () => 'offline-backend', getSupabasePublishableKey: () => 'offline-public',
    hasBackendApiKey: () => backend,
    Deno: { env: { get: key => key === 'CRON_TRIGGER_KEY' ? cron : 'https://offline.test' } },
    createApiClient: () => ({
      auth: { getUser: async () => ({ data: { user: tokenValid ? { id:'user-fixture', user_metadata:{ role:'admin' } } : null }, error: authError ? Error('invalid') : null }) },
      from: () => { const q={ select:()=>q, eq:()=>q, maybeSingle:async()=>({data:active?{id:'user-fixture'}:null}) }; return q },
    }),
  }
  runInNewContext(source+'\nglobalThis.authorize = authorizeStoreRequest', context)
  return context.authorize
}

test('protected endpoints require validated active admins, backend identity or explicitly enabled cron token', async () => {
  const req = token => new Request('https://offline.test', { headers: token ? { Authorization:`Bearer ${token}` } : {} })
  assert.equal(await authorizer()(req(),()=>{}),false)
  assert.equal(await authorizer({tokenValid:true})(req('user'),()=>{}),false)
  assert.equal(await authorizer({tokenValid:true,active:true})(req('user'),()=>{}),true)
  assert.equal(await authorizer({tokenValid:true,active:true,authError:true})(req('user'),()=>{}),false)
  assert.equal(await authorizer({backend:true})(req(),()=>{}),true)
  assert.equal(await authorizer({cron:'cron-fixture'})(req('cron-fixture'),()=>{}),false)
  assert.equal(await authorizer({cron:'cron-fixture'})(req('cron-fixture'),()=>{},{allowCron:true}),true)
})

for (const name of ['generate-blog-post','check-tracking-status','setup-cron-jobs','send-tracking-email','send-delivery-email','finalize-tax-transaction']) {
  test(`${name}: denied authorization exits before parsing payload or initializing services`, async () => {
    let handler, touched = 0
    const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url),'utf8').replace(/^import .*\n/gm,'')
    runInNewContext(stripTypeScriptTypes(source), {
      serve: fn => { handler=fn }, Response, Request, Date,
      authorizeStoreRequest:async()=>false,
      createClient:()=>{ touched++; throw Error('forbidden') },
      Deno:{env:{get:()=>{ touched++; throw Error('forbidden') }}},
      fetch:()=>{ touched++; throw Error('forbidden') },
    })
    const response = await handler(new Request('https://offline.test',{method:'POST',body:'invalid json'}))
    assert.equal(response.status,401)
    assert.equal(touched,0)
  })
}
