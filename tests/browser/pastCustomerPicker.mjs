import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const origin=process.env.REFERRAL_FIXTURE_ORIGIN||'http://127.0.0.1:3017',requests=[]
const customers=Array.from({length:51},(_,i)=>({name:i===49?'Late Customer':'Customer '+i,email:`customer${String(i).padStart(2,'0')}@fixture.invalid`}))
await fs.mkdir('docs/referrals/screenshots',{recursive:true})
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort()
  if(url.pathname==='/__past_customers'){
   const input=JSON.parse(route.request().postData());requests.push(input)
   if(input.query==='error')return route.fulfill({status:500,json:{error:'offline'}})
   if(input.query==='slow'){await new Promise(r=>setTimeout(r,650));return route.fulfill({json:{customers:[{name:'Stale Result',email:'stale@fixture.invalid'}],nextCursor:null}})}
   if(input.query==='fresh')return route.fulfill({json:{customers:[{name:'Fresh Result',email:'fresh@fixture.invalid'}],nextCursor:null}})
   if(input.query==='markup')return route.fulfill({json:{customers:[{name:'<img src=x onerror=window.fixtureExecuted=true>',email:'markup@fixture.invalid'}],nextCursor:null}})
   const filtered=customers.filter(x=>(x.name+' '+x.email).toLowerCase().includes(input.query.toLowerCase())&&(!input.after||x.email>input.after)),shown=filtered.slice(0,25)
   return route.fulfill({json:{customers:shown,nextCursor:filtered.length>25?shown.at(-1).email:null}})
  }
  if(url.pathname==='/__customer_picker')return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/pastCustomerPickerHarness.jsx');</script>`})
  return route.continue()
 })
 await page.goto(origin+'/__customer_picker');const input=page.getByRole('combobox',{name:'Find a past customer'})
 await input.focus();await page.getByRole('option').first().waitFor();assert.equal(await page.getByRole('option').count(),25)
 await page.getByRole('button',{name:'Load more customers'}).click();await page.waitForFunction(()=>document.querySelectorAll('[role=option]').length===50)
 await page.getByRole('button',{name:'Load more customers'}).click();await page.waitForFunction(()=>document.querySelectorAll('[role=option]').length===51)
 await input.fill('LATE CUSTOMER');await page.getByRole('option',{name:/Late Customer/}).waitFor();assert.equal(await page.getByRole('option').count(),1)
 await page.screenshot({path:`docs/referrals/screenshots/past-customers-${width}.png`,fullPage:true})
 await input.press('ArrowDown');await input.press('Enter');await page.getByText('Selected: customer49@fixture.invalid',{exact:true}).waitFor();assert.equal(await input.getAttribute('aria-expanded'),'false')
 const slowRequested=page.waitForRequest(request=>request.url().endsWith('/__past_customers')&&JSON.parse(request.postData()).query==='slow');await input.fill('slow');await slowRequested
 await input.fill('fresh');await page.getByRole('option',{name:/Fresh Result/}).waitFor();await page.waitForTimeout(750);assert.equal(await page.getByRole('option',{name:/Stale Result/}).count(),0)
 await input.fill('error');await page.getByText('Could not load past customers. Try your search again.').waitFor()
 await input.fill('no match');await page.getByText('No matching past customers.',{exact:true}).waitFor()
 await input.fill('markup');await page.getByRole('option',{name:/<img src=x/}).waitFor();assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.fixtureExecuted),undefined)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');assert.deepEqual(errors,[])
 await context.close()
}}finally{await browser.close()}
assert.ok(requests.every(x=>Object.keys(x).sort().join(',')==='after,query'))
console.log('PASS isolated desktop/mobile customer picker: pagination, late name/email search, keyboard, stale-response rejection, network-error recovery, literal untrusted names, no overflow or external traffic; no write/email action')
