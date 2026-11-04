import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readBoundedJson} from '../../supabase/functions/_shared/boundedJson.js'
const request=body=>new Request('http://fixture.invalid',{method:'POST',body})
test('public challenge body accepts bounded JSON and rejects invalid or malformed UTF-8',async()=>{
 assert.deepEqual(await readBoundedJson(request('{"action":"challenge"}')),{action:'challenge'})
 await assert.rejects(()=>readBoundedJson(request('not JSON')))
 await assert.rejects(()=>readBoundedJson(request(new Uint8Array([0xff]))))
})
test('declared oversize bodies fail before reading and UTF-8 limits count bytes rather than characters',async()=>{
 const req=new Request('http://fixture.invalid',{method:'POST',headers:{'content-length':'9999999'},body:'{}'})
 await assert.rejects(()=>readBoundedJson(req),/too large/);assert.equal(req.bodyUsed,false)
 await assert.rejects(()=>readBoundedJson(request(JSON.stringify({text:'é'.repeat(2500)}))),/too large/)
})
test('chunked bodies cannot evade the hard limit and their stream is cancelled',async()=>{
 let cancelled=false
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(4096));c.enqueue(new Uint8Array(1))},cancel(){cancelled=true}})
 const req={headers:new Headers(),body:stream}
 await assert.rejects(()=>readBoundedJson(req),/too large/);assert.equal(cancelled,true)
})
test('a stalled body times out and its stream is cancelled without accepting partial JSON',async()=>{
 let cancelled=false
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{}'))},cancel(){cancelled=true}})
 await assert.rejects(()=>readBoundedJson({headers:new Headers(),body:stream},{timeoutMs:5}),/timed out/)
 assert.equal(cancelled,true)
})
