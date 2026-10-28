import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

test('live wall refuses missing, empty or wrong token before database access', async () => {
  const source = readFileSync(new URL('../../supabase/functions/live-wall-stats/index.ts', import.meta.url),'utf8').replace(/^import .*\n/gm,'')
  for (const token of [undefined, '', 'offline-expected-fixture']) {
    let handler, queries = 0
    const db = { from: () => { queries++; throw Error('database access forbidden') } }
    runInNewContext(stripTypeScriptTypes(source), {
      serve: fn => { handler = fn }, Request, Response, Date, URL,
      Deno: { serve: fn => { handler = fn }, env: { get: key => key === 'LIVE_WALL_TOKEN' ? token : 'https://offline.test' } },
      getSupabaseSecretKey: () => 'sb_secret_offline_fixture', createClient: () => db, createApiClient: () => db,
    })
    for (const supplied of ['', 'offline-wrong-fixture']) {
      const response = await handler(new Request('https://offline.test', { headers: supplied ? { Authorization:`Bearer ${supplied}` } : {} }))
      assert.equal(response.status,401)
      assert.equal(queries,0)
    }
  }
})
