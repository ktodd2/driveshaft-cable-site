import {build} from 'esbuild'
import {runInNewContext} from 'node:vm'
import assert from 'node:assert/strict'
export async function verifyRetiredEndpoint(name){
 let handler
 const output=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'no-side-effects',setup(b){
  b.onResolve({filter:/https:/},a=>{assert.match(a.path,/deno.land\/std@.*\/http\/server.ts$/);return {path:a.path,namespace:'mock'}})
  b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const serve=fn=>capture(fn)',loader:'js'}))
 }}]})
 const module={exports:{}};runInNewContext(output.outputFiles[0].text,{capture:fn=>handler=fn,module,exports:module.exports,Response})
 for(const method of ['GET','POST','PUT','DELETE']){
  const r=await handler(new Request('https://fixture.invalid/'+name,{method,...(method==='POST'?{body:JSON.stringify({action:'create',enabled:true,emailEnabled:true,paid:true})}:{})}));assert.equal(r.status,410);assert.deepEqual(await r.json(),{error:'The referral program has ended.'})
 }
 assert.equal((await handler(new Request('https://fixture.invalid/'+name,{method:'OPTIONS'}))).status,200)
}
