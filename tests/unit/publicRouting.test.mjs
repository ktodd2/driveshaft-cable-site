import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {STATIC_PUBLIC_PATHS} from '../../scripts/sitemap-helpers.mjs'
import {routeFile} from '../../scripts/prerender-helpers.mjs'

test('every static public page reaches its prerendered HTML before the Render SPA fallback',()=>{
 const yaml=readFileSync(new URL('../../render.yaml',import.meta.url),'utf8')
 const routes=[...yaml.matchAll(/- type: (rewrite|redirect)\s+source: (\S+)\s+destination: (\S+)/g)].map(([,type,source,destination])=>({type,source,destination}))
 const fallback=routes.findIndex(route=>route.source==='/*')
 assert.ok(fallback>=0);assert.equal(fallback,routes.length-1,'catch-all stays last')
 for(const path of STATIC_PUBLIC_PATHS.filter(path=>path!=='/')){
  const index=routes.findIndex(route=>route.source===path)
  assert.ok(index>=0&&index<fallback,`${path} needs a specific Render rewrite`)
  assert.deepEqual(routes[index],{type:'rewrite',source:path,destination:'/'+routeFile(path)})
 }
})

test('portable redirect file maps referral HTML before its unchanged SPA fallback',()=>{
 const lines=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8').trim().split('\n').map(line=>line.trim().split(/\s+/))
 assert.deepEqual(lines[0],['/referrals','/referrals/index.html','200'])
 assert.deepEqual(lines.at(-1),['/*','/index.html','200'])
})
