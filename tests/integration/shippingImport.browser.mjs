// Fixture-only browser QA; all backend requests are mocked, never production writes.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
try {
const context = await browser.newContext(), page = await context.newPage(), errors = []
page.on('pageerror', e => errors.push(e.message))
const base = {payment_status:'paid',status:'shipped',created_at:'2026-10-28T12:00:00Z',items:[],total_cents:5000,email:'fixture@example.invalid',actual_shipping_cost_cents:null,tracking_number:'KEEP123'}
const orders = [{...base,id:'a',name:'Alex Fixture'}, {...base,id:'z',name:'Zero Fixture',tracking_number:null}, {...base,id:'s1',name:'Same Name'}, {...base,id:'s2',name:'Same Name'}, {...base,id:'c',name:'Conflict Fixture',actual_shipping_cost_cents:800}]
const receipts=[], requests=[]
let loseNext=false, concurrent=false, failReads=false
await context.addInitScript(() => localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:9999999999,user:{id:'fixture-admin',email:'admin@example.invalid'}})))
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop()
 if(url.port==='4178') return route.continue()
 if(url.hostname==='js.stripe.com') return route.fulfill({contentType:'application/javascript',body:'window.Stripe=function(){return {}}'})
 if(url.port!=='9999') return route.abort()
 if(req.method()==='POST' && table==='get_suggestion_attention') return route.fulfill({json:[]})
 if(req.method()==='POST'){
  assert.equal(table,'apply_shipping_import','No email/status/other mutation permitted')
  const p=req.postDataJSON();requests.push(p)
  const o=orders.find(o=>o.id===p.p_order_id)
  assert.equal(p.p_tracking,o.tracking_number);assert.equal(p.p_expected_tracking,o.tracking_number)
  if(concurrent){concurrent=false;o.actual_shipping_cost_cents=999;return route.fulfill({status:409,json:{message:'Order cost or tracking changed since preview.'}})}
  assert.equal(o.actual_shipping_cost_cents,null)
  o.actual_shipping_cost_cents=p.p_labels.reduce((s,l)=>s+l.cost_cents,0)
  receipts.push({id:receipts.length+1,order_id:o.id,source_keys:p.p_labels.map(l=>l.source_key),labels:p.p_labels,after_cost:o.actual_shipping_cost_cents,after_tracking:o.tracking_number,filename:p.p_filename,created_at:new Date().toISOString()})
  if(loseNext){loseNext=false;return route.fulfill({status:503,json:{message:'Response lost after save; upload again to check.'}})}
  return route.fulfill({json:{status:'saved'}})
 }
 assert.ok(['GET','HEAD','OPTIONS'].includes(req.method()))
 if(failReads&&table==='shipping_import_receipts')return route.fulfill({status:503,json:{message:'offline'}})
 const data=table==='orders'?orders:table==='shipping_import_receipts'?receipts:[]
 return route.fulfill({json:data,headers:{'content-range':`0-${Math.max(0,data.length-1)}/${data.length}`}})
})
await page.setViewportSize({width:1440,height:1100})
await page.goto('http://127.0.0.1:4178/admin')
const panel=page.getByRole('region',{name:'BULK SHIPPING IMPORT'}),input=panel.getByLabel('Pirate Ship CSV or XLSX')
await panel.waitFor()
assert.equal(await panel.getByRole('button',{name:/Preview|Save confirmed/}).count(),0)
await mkdir('qa/shipping-auto',{recursive:true})
await panel.screenshot({path:'qa/shipping-auto/desktop-ready.png',style:'header {visibility:hidden}'})
const upload=async(text,name='fixture.csv')=>input.setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(text)})
await input.setInputFiles('tests/fixtures/pirate-ship-transactions.csv')
await panel.getByText('2 orders updated · 0 already recorded · 2 need attention').waitFor()
assert.equal(requests.length,2);assert.equal(orders[0].tracking_number,'KEEP123');assert.equal(orders[1].actual_shipping_cost_cents,0);assert.equal(orders[4].actual_shipping_cost_cents,800)
assert.equal(await panel.getByRole('combobox').count(),0)
await panel.screenshot({path:'qa/shipping-auto/desktop-result.png',style:'header {visibility:hidden}'})
await page.setViewportSize({width:390,height:844})
assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth))
await panel.screenshot({path:'qa/shipping-auto/mobile-result.png',style:'header {visibility:hidden}'})
await input.setInputFiles('tests/fixtures/pirate-ship-transactions.csv')
await panel.getByText('0 orders updated · 2 already recorded · 2 need attention').waitFor()
assert.equal(requests.length,2)
await upload('Name,Email,Cost,Tracking Number\nConflict Fixture,fixture@example.invalid,9,KEEP123')
await panel.getByText('0 orders updated · 0 already recorded · 1 need attention').waitFor()
assert.equal(requests.length,2)
orders.push({...base,id:'retry',name:'Retry Fixture',tracking_number:null})
loseNext=true
const retry='Date,Type,Description,Total,Balance\n10/29/26 10:40 PM CDT,Label,Retry Fixture: 1 Label Batch,-3.00,1.00'
await upload(retry);await panel.getByText(/Response lost after save/).waitFor()
await upload(retry);await panel.getByText('0 orders updated · 1 already recorded · 0 need attention').waitFor()
assert.equal(requests.length,3)
orders.push({...base,id:'stale',name:'Stale Fixture',tracking_number:null});concurrent=true
await upload('Date,Type,Description,Total,Balance\n10/29/26 10:40 PM CDT,Label,Stale Fixture: 1 Label Batch,-3.00,1.00')
await panel.getByText(/changed since preview/).waitFor();assert.equal(orders.at(-1).actual_shipping_cost_cents,999)
const writes=requests.length
await upload('Name,Cost\n"bad,2');await panel.getByRole('alert').waitFor();assert.equal(requests.length,writes)
await upload('junk','bad.xlsx');await panel.getByRole('alert').waitFor();assert.equal(requests.length,writes)
await input.setInputFiles('tests/fixtures/shipping-import.xlsx')
await panel.getByRole('status').filter({hasText:/need attention/}).waitFor();assert.equal(requests.length,writes)
failReads=true
await input.setInputFiles('tests/fixtures/pirate-ship-transactions.csv')
await panel.getByRole('alert').filter({hasText:/Unable to load/}).waitFor();assert.equal(requests.length,writes)
assert.deepEqual(errors,[])
console.log('Automatic upload desktop/mobile QA passed: no wizard or per-row buttons, exact ledger matches, zero, same-name ambiguity, cost conflicts, repeated upload, lost-response recovery, concurrent edit, malformed CSV/XLSX, failed history read, tracking/status/email preservation.')
}finally{await browser.close()}
