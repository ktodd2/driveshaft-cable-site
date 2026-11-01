import assert from 'node:assert/strict'
import {planSignature} from '../../src/lib/inventoryPlanStorage.js'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch(process.env.REPORT_BROWSER?{executablePath:process.env.REPORT_BROWSER}:{})
let state={revision:0,document:{days:30,lead:'',safety:'',lines:[]}},requests=new Map(),failAfterSave=false,missing=false,forbidden=false
async function pageFor(width){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'})
 const page=await context.newPage();page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort()
  const reply=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)})
  if(url.pathname.startsWith('/__plan/')){
   if(missing)return reply({error:{code:'PGRST202'}})
   if(forbidden)return reply({error:{code:'42501'}})
   if(url.pathname.endsWith('get_inventory_plan'))return reply({data:JSON.parse(planSignature(state))})
   const args=JSON.parse(route.request().postData());const previous=requests.get(args.p_request_id)
   if(previous){assert.deepEqual(args,previous.args);return reply({data:{status:'already_saved',revision:previous.revision,current_revision:state.revision}})}
   if(args.p_expected_revision!==state.revision)return reply({error:{code:'40001'}})
   state={revision:state.revision+1,document:args.p_document};requests.set(args.p_request_id,{args,revision:state.revision})
   if(failAfterSave){failAfterSave=false;return route.abort()}
   return reply({data:{status:'saved',revision:state.revision,current_revision:state.revision}})
  }
  if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase={};'})
  if(url.pathname==='/__inventory_test')return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/inventoryPlanningHarness.jsx');</script>`})
  return route.continue()
 })
 await page.goto('http://127.0.0.1:3012/__inventory_test?mode=shared')
 return {page,context,errors}
}
async function load(page){await page.getByRole('button',{name:'Fetch shared plan',exact:true}).click();await page.getByRole('button',{name:'Replace editor with fetched plan',exact:false}).click()}
try{
 const desktop=await pageFor(1440),mobile=await pageFor(390),a=desktop.page,b=mobile.page
 await load(a);await load(b);assert.equal(await a.getByText('Unsaved shared changes in this editor.',{exact:true}).count(),0);assert.equal(await b.getByText('Unsaved shared changes in this editor.',{exact:true}).count(),0)
 await a.getByLabel('Supplier lead time (days)').fill('45');await a.getByLabel('Safety cushion (days)').fill('7')
 await a.getByRole('button',{name:'Add incoming draft line'}).click();await a.getByLabel('Shipment reference').fill('Shared fixture');await a.getByLabel('Product',{exact:true}).selectOption('1');await a.getByLabel('Ordered units').fill('100')
 failAfterSave=true
 await a.getByRole('button',{name:'Save shared plan',exact:true}).click();await a.getByText('Save outcome is uncertain.',{exact:false}).waitFor()
 assert.equal(await a.getByLabel('Supplier lead time (days)').isDisabled(),true)
 await a.getByRole('button',{name:'Retry previous shared save'}).click();await a.getByText('Shared revision 1 saved.',{exact:false}).waitFor();assert.equal(requests.size,1)
 await b.getByLabel('Supplier lead time (days)').fill('20');await b.getByRole('button',{name:'Save shared plan',exact:true}).click();await b.getByText('Another device changed the plan.',{exact:false}).waitFor()
 assert.equal(await b.getByLabel('Supplier lead time (days)').inputValue(),'20')
 await load(b);assert.equal(await b.getByLabel('Supplier lead time (days)').inputValue(),'45');assert.equal(await b.getByLabel('Shipment reference').inputValue(),'Shared fixture')
 assert.equal(await b.evaluate(()=>JSON.parse(localStorage.getItem('inventory-planning-before-shared')).lead),'20')
 await b.getByLabel('Safety cushion (days)').fill('10');await b.getByRole('button',{name:'Save shared plan',exact:true}).click();await b.getByText('Shared revision 2 saved.',{exact:false}).waitFor()
 for(const p of [a,b]){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`/tmp/inventory-shared-${p===a?1440:390}.png`,fullPage:true})}
 missing=true;await a.getByRole('button',{name:'Fetch shared plan',exact:true}).click();await a.getByText('Shared storage is not installed.',{exact:false}).waitFor();assert.equal(await a.getByLabel('Shipment reference').inputValue(),'Shared fixture')
 missing=false;forbidden=true;await a.getByRole('button',{name:'Fetch shared plan',exact:true}).click();await a.getByText('Active admin access is required',{exact:false}).waitFor()
 assert.deepEqual(desktop.errors,[]);assert.deepEqual(mobile.errors,[])
 console.log('PASS shared storage desktop/mobile: cross-device load, exact retry after lost response, stale conflict preserves editor, recovery backup, absent backend, admin denial, no overflow')
 await desktop.context.close();await mobile.context.close()
}finally{await browser.close()}
