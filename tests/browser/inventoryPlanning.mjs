import assert from 'node:assert/strict'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch(process.env.REPORT_BROWSER?{executablePath:process.env.REPORT_BROWSER}:{})
try{
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'})
 const page=await context.newPage();page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',route=>{
 const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort()
 if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase={};'})
 if(url.pathname==='/__inventory_test')return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/inventoryPlanningHarness.jsx');</script>`})
 return route.continue()})
 await page.goto('http://127.0.0.1:3012/__inventory_test')
 await page.getByText('Runway: 10.0 days',{exact:false}).waitFor()
 await page.getByLabel('Supplier lead time (days)').fill('30');await page.getByLabel('Safety cushion (days)').fill('5')
 await page.getByText('Reorder review needed',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Add incoming draft line'}).click()
 await page.getByLabel('Shipment reference').fill('PO-fixture')
 await page.getByLabel('Product',{exact:true}).selectOption('1')
 await page.getByLabel('Ordered units').fill('100')
 await page.getByLabel('Earliest estimated date').fill('2026-12-01');await page.getByLabel('Latest estimated date').fill('2026-12-16')
 await page.getByLabel('Verified matching receipts').selectOption('receipt-fixture')
 await page.getByText('40 linked received · 60 outstanding',{exact:false}).waitFor()
 await page.getByRole('button',{name:'Save draft on this browser'}).click()
 await page.reload();await page.getByRole('button',{name:'Load browser draft'}).click()
 assert.equal(await page.getByLabel('Shipment reference').inputValue(),'PO-fixture')
 await page.getByRole('button',{name:'Add incoming draft line'}).click()
 await page.getByLabel('Shipment reference').nth(1).fill('PO-fixture');await page.getByLabel('Product',{exact:true}).nth(1).selectOption('1');await page.getByLabel('Ordered units').nth(1).fill('100')
 assert.ok(await page.getByText('Duplicate reference/product',{exact:false}).count()>0)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.screenshot({path:`/tmp/inventory-${width}.png`,fullPage:true})
 for(const mode of ['error','stale','loading']){
 await page.goto('http://127.0.0.1:3012/__inventory_test?mode='+mode)
 await page.getByRole(mode==='loading'?'status':'alert').filter({hasText:mode==='loading'?'Loading complete inventory snapshot':mode==='stale'?'Snapshot is over':'Inventory planning data unavailable'}).waitFor()
 assert.equal(await page.getByRole('article').count(),0)
 }
 assert.deepEqual(errors,[]);console.log(`PASS inventory ${width}px: runway, settings, partial receipt, draft persistence, duplicates, stale/error/loading, no overflow`)
 await context.close()
}
}finally{await browser.close()}
