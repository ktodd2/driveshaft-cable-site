import assert from 'node:assert/strict'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch(process.env.REPORT_BROWSER?{executablePath:process.env.REPORT_BROWSER}:{})
let mode='full',calls=0
const stamp=new Date(Date.now()-600000).toISOString()
const record={checked_at:stamp,summary:[{automation:'send-reorder-reminder',last_attempted:'2020-01-01',last_successful:null}],runs:[{id:'r',automation:'send-reorder-reminder',started_at:stamp,status:'completed',counts:{eligible:0,accepted:0,skipped:3}}],emails:[{id:'e',automation:'send-tracking-email-v2',entity_id:'fixture-order',started_at:stamp,status:'uncertain',reason:'provider_outcome_unknown'}]}
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',async route=>{
 const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort()
 if(url.pathname==='/__health') {calls++;assert.equal(JSON.parse(route.request().postData()).name,'get_email_health');return route.fulfill({contentType:'application/json',body:JSON.stringify(mode==='error'?{error:{code:'42501'}}:{data:mode==='empty'?{checked_at:stamp,runs:[],summary:[],emails:[]}:record})})}
 if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase={};'})
 if(url.pathname==='/__email_test')return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/emailHealthHarness.jsx');</script>`})
 return route.continue()
 })
 mode='full';await page.goto('http://127.0.0.1:3017/__email_test');await page.getByText('provider outcome unknown',{exact:true}).waitFor();await page.reload();await page.getByText('provider outcome unknown',{exact:true}).waitFor()
 assert.equal(await page.getByText('Stale execution evidence — review schedule',{exact:true}).count(),1)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.screenshot({path:`/tmp/email-health-${width}.png`,fullPage:true})
 mode='error';await page.getByRole('button',{name:'Refresh history'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByText('provider outcome unknown',{exact:true}).count(),1)
 mode='empty';await page.getByRole('button',{name:'Refresh history'}).click();await page.getByText('No saved attempts yet.',{exact:false}).waitFor()
 assert.deepEqual(errors,[]);await context.close()
}console.log(`PASS desktop/mobile: persisted reload, UTC, empty/error/stale states, no overflow, ${calls} read-only RPC calls, no sends`)}finally{await browser.close()}
