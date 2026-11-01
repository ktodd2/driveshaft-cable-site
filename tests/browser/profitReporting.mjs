// Local fixture QA only. External requests are blocked. No production credentials.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import Papa from 'papaparse'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch(process.env.REPORT_BROWSER?{executablePath:process.env.REPORT_BROWSER}:{})
const mock=`
const mode=new URLSearchParams(location.search).get('mode');
const o={id:'fixture-order',created_at:new Date().toISOString(),name:'Example Customer',email:'example@example.test',payment_status:'paid',status:'confirmed',payment_method:'stripe',total_cents:1250,tax_cents:50,subtotal_cents:1200,discount_cents:100,shipping_cents:100,actual_shipping_cost_cents:mode==='complete'?0:null,items:[{productId:'1',quantity:2,price:400},{productId:'2',quantity:1,price:400}]};
const rows={orders:mode==='empty'?[]:[o,{...o,id:'excluded',status:'cancelled'}],products:[{id:'1',name:'Cable',is_active:true},{id:'2',name:'Cable Plus',is_active:true}],product_shipments:[{id:1,product_id:'1',quantity:2,total_cost_cents:200,received_at:o.created_at},{id:2,product_id:'2',quantity:1,total_cost_cents:300,received_at:o.created_at}],product_inventory:[],quote_requests:[],testimonials:[]};
class Query{constructor(table){this.table=table;this.start=0;this.end=999}select(){return this}order(){return this}eq(){return this}neq(){return this}limit(){return this}range(a,b){this.start=a;this.end=b;return this}then(resolve){return Promise.resolve(mode==='error'&&this.table==='orders'||mode==='cost-error'&&this.table==='product_shipments'?{error:Error('fixture unavailable')}:{data:(rows[this.table]||[]).slice(this.start,this.end+1),count:0}).then(resolve)}}
export const supabase={from:t=>new Query(t),auth:{getSession:async()=>({data:{session:{user:{email:'admin@example.test'}}}}),signOut:async()=>{}},functions:{invoke:async()=>({data:{}})}};`
try{
 for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',route=>{
 const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
 if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:mock})
 if(['/src/components/admin/NeedsAttention.jsx','/src/components/admin/ShippingImportReview.jsx'].includes(url.pathname))return route.fulfill({contentType:'text/javascript',body:'export default function Fixture(){return null}'})
 if(url.pathname==='/__report_test')return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/profitReportingHarness.jsx');</script>`})
 return route.continue()})
 for(const view of ['dashboard','analytics']){
  await page.goto('http://127.0.0.1:3012/__report_test?view='+view);await page.getByRole('note').waitFor()
  await page.getByText('1 included orders lack recorded shipping costs',{exact:false}).waitFor()
  assert.ok(await page.getByText('Incomplete',{exact:true}).count()>0)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,view+' overflow')
  await page.screenshot({path:'/tmp/profit-'+view+'-'+width+'.png',fullPage:true})
  if(view==='analytics'){
   const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Bookkeeping CSV (whole orders)'}).click();const download=await downloadPromise;const csv=await fs.readFile(await download.path(),'utf8');const rows=Papa.parse(csv,{header:true}).data;assert.equal(rows.length,1);assert.equal(rows[0].order_id,'fixture-order');assert.equal(rows[0].actual_shipping_cost_cents,'');assert.equal(rows[0].contribution_estimate_cents,'');assert.equal(rows[0].refund_status,'unreconciled');await fs.writeFile('/tmp/profit-bookkeeping-fixture.csv',csv)
   await page.getByRole('spinbutton').fill('200');await page.getByText('$4.34',{exact:true}).first().waitFor()
   await page.getByRole('combobox',{name:'Product filter'}).selectOption('1');await page.getByRole('note').waitFor()
   if(width===1440){const pdfPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const pdf=await pdfPromise;assert.ok((await fs.stat(await pdf.path())).size>1000)}
  }
  await page.evaluate(()=>localStorage.clear())
  await page.goto('http://127.0.0.1:3012/__report_test?view='+view+'&mode=complete');await page.getByRole('note').waitFor();await page.getByText('$6.34',{exact:true}).first().waitFor()
  for(const mode of ['empty','error','cost-error']){
   await page.goto('http://127.0.0.1:3012/__report_test?view='+view+'&mode='+mode)
   if(mode==='empty')await page.getByRole('note').waitFor();else{await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('note').count(),0)}
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS reporting '+width+'px: both pages, matching totals, unknown/zero shipping, estimate, product filter, CSV, empty/error, no overflow');await context.close()
 }
}finally{await browser.close()}
