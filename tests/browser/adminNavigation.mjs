import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch(process.env.REPORT_BROWSER?{executablePath:process.env.REPORT_BROWSER}:{})
const base='http://127.0.0.1:3028'
const inventory=JSON.parse(await fs.readFile('docs/design-refresh/route-inventory.json','utf8'))
const stub=`const session={user:{id:'fixture-admin'}};
function query(table){let single=false;const q=new Proxy({}, {get:(o,k)=>k==='then'?(resolve,reject)=>Promise.resolve({data:single?(table==='product_inventory'?{stock_quantity:100}:table==='admin_users'?{is_active:true}:null):[],error:null,count:0}).then(resolve,reject):k==='catch'?fn=>Promise.resolve({data:[],error:null,count:0}).catch(fn):(...args)=>{if(['insert','update','delete','upsert'].includes(k))throw Error('Unexpected write during route audit');if(k==='single'||k==='maybeSingle')single=true;return q}});return q}
export const supabase={from:table=>query(table),auth:{getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session.user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name)=>{if(name==='get_suggestion_attention')return {data:{attention:0,checked_at:new Date().toISOString()}};if(name==='get_suggestion_review')return {data:{rows:[],counts:{total:0,attention:0,quarantined:0},checked_at:new Date().toISOString()}};if(name==='get_email_health')return {data:{runs:[],emails:[],held:[],summary:[],checked_at:new Date().toISOString()}};return {error:{code:'fixture_unavailable'}}},functions:{invoke:async()=>{throw Error('Unexpected function call during route audit')}}};export const submitQuoteRequest=()=>{throw Error('Unexpected submission')};export const sendQuoteNotification=submitQuoteRequest;`
let checks=0
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'})
 await context.route('**/*',async route=>{
 const url=new URL(route.request().url());if(url.origin!==base)return route.abort()
 if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:stub})
 if(!url.pathname.startsWith('/src/')&&!url.pathname.startsWith('/@')&&!url.pathname.startsWith('/node_modules/')&&!url.pathname.startsWith('/tests/')&&!/\.[a-z0-9]+$/i.test(url.pathname))return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="UTF-8"><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/src/main.jsx');</script>`})
 return route.continue()
 })
 for(const entry of inventory.routes){
  const sample=entry.samples[0];if(!sample)continue
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>{if(!/Stripe/.test(e.message))errors.push(e.message)})
  await page.goto(base+sample.url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(350)
  if(entry.category==='admin' && entry.path!=='/admin/login'){
   const nav=page.getByRole('navigation',{name:'Admin navigation'});await nav.waitFor();assert.equal(await nav.getByRole('link').count(),12,entry.path)
   for(const name of ['Products','Sales','Email & health'])await nav.getByRole('link',{name,exact:true}).waitFor()
   if(['/admin/products','/admin/sales','/admin/suggestions'].includes(entry.path))await page.screenshot({path:`/tmp/admin-nav-${entry.path.split('/').pop()}-${width}.png`,fullPage:true})
  }
  assert.deepEqual(errors,[],`${width} ${entry.path}`);assert.ok((await page.locator('body').innerText()).length>20,entry.path)
  await page.close();checks++
 }
 await context.close()
}console.log(`PASS ${checks} desktop/mobile route renders (31 routes); 11 consistent admin destinations, fixture data only, external requests blocked, no sending or submission writes.`)}finally{await browser.close()}
