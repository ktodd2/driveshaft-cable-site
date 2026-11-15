import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextSaleBoundaryDelay, startSaleClock } from '../../src/lib/saleClock.js'
import { readFileSync } from 'node:fs'
const sale = { is_active: true, starts_at: new Date(1000).toISOString(), ends_at: new Date(2000).toISOString() }
test('clock schedules future start, exact expiry, and no expired/disabled sale', () => {
  assert.equal(nextSaleBoundaryDelay([sale], 500), 500)
  assert.equal(nextSaleBoundaryDelay([sale], 1000), 1000)
  assert.equal(nextSaleBoundaryDelay([sale], 2000), null)
  assert.equal(nextSaleBoundaryDelay([{...sale, is_active:false}], 500), null)
  assert.equal(nextSaleBoundaryDelay([{...sale, ends_at:'invalid', starts_at:'invalid'}], 0), null)
  assert.equal(nextSaleBoundaryDelay([sale], -1e12), 2147483647)
})
test('clock refreshes at boundary, resumes sleeping tabs, and cleans up', () => {
  let time = 500, count = 0, callback, delay, subscribed, removed = 0
  const events = new Map()
  const stop = startSaleClock({readSales:()=>[sale], refresh:()=>count++, now:()=>time,
    schedule:(fn,ms)=>{callback=fn;delay=ms;return 1},cancel:()=>{},
    subscribe:fn=>{subscribed=fn;return ()=>removed++},
    target:{addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)}})
  assert.equal(delay,500);time=1000;callback();assert.equal(count,1);assert.equal(delay,1000)
  time=2000;events.get('focus')();assert.equal(count,2)
  subscribed();stop();assert.equal(removed,1);assert.equal(events.size,0)
})
test('static prerender never embeds transient sale snapshots', () => {
  const source = readFileSync(new URL('../../scripts/prerender.mjs', import.meta.url),'utf8')
  assert.match(source, /sales: \[\]/)
  assert.doesNotMatch(source, /sales: data.sales/)
})
