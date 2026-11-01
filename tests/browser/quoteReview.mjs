// Run with QUOTE_PLAYWRIGHT_MODULE (absolute index.mjs) and optional QUOTE_BROWSER.
// Local Vite on port 3011. External traffic is blocked; all records are synthetic.
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.QUOTE_PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch(process.env.QUOTE_BROWSER?{executablePath:process.env.QUOTE_BROWSER}:{})
const mock=`
window.fixture={calls:0,mode:'normal'};
const quote={id:1,name:'Alex Example',email:'alex@example.test',company:'Example Towing',message:'Do you have ten cables?',quantity:10,status:'new',created_at:'2026-02-01T12:00:00Z'};
export const supabase={auth:{signOut:async()=>{}},functions:{invoke:async()=>{
window.fixture.calls++; const mode=window.fixture.mode; await new Promise(r=>setTimeout(r,150));
if(mode==='error')return {error:Error('offline')};
return {data:{checkedAt:mode==='stale'?'2020-01-01':new Date().toISOString(),sources:{
quotes:{rows:mode==='empty'?[]:[quote,{...quote,id:2,name:'Blake Example',email:'blake@example.test',message:'Another request'}]},
orders:mode==='partial'?{error:true,rows:[]}:{rows:[{id:'order-fixture',email:' ALEX@EXAMPLE.TEST ',created_at:'2026-03-01',payment_status:'paid',status:'shipped'}]},
sends:{rows:[{id:1,email:quote.email,campaign_id:7,cycle:1,sent_at:'2026-04-01'}]},
preferences:{rows:[{id:1,email:'blake@example.test',status:'unsubscribed'}]}
}}};
}}};`
try{
 for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',route=>{
 const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
 if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:mock});
 if(url.pathname==='/__quote_test')return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/quoteReviewHarness.jsx');</script>`});
 return route.continue();})
 await page.goto('http://127.0.0.1:3011/__quote_test');await page.getByText('2 of 2 quotes · oldest first').waitFor();
 assert.equal(await page.getByText('Unknown — check your inbox',{exact:true}).count(),2)
 await page.locator('#quote-1 summary').click();assert.equal(await page.getByRole('link',{name:/Order order-fi/}).getAttribute('href'),'/admin/orders?order=order-fixture');
 await page.getByText('Opt-out recorded. Review preferences; do not send marketing follow-ups.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:'/tmp/quote-review-'+width+'.png',fullPage:true})
 const input=page.getByPlaceholder('Name, email or company');await input.fill('no match');await page.getByText('No quotes match your search.').waitFor();await input.fill('')
 await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh records');b.click();b.click()});await page.getByText('2 of 2 quotes · oldest first').waitFor();assert.equal(await page.evaluate(()=>window.fixture.calls),2)
 for(const [mode,text] of [['partial','orders unavailable.'],['error','Review unavailable.'],['empty','No quote requests in this snapshot.'],['stale','This snapshot is over 5 minutes old.']]){
 await page.evaluate(mode=>window.fixture.mode=mode,mode);await page.getByRole('button',{name:'Refresh records',exact:true}).click();await page.getByText(text,{exact:false}).waitFor();if(mode==='error')assert.equal(await page.locator('article').count(),0)
 }
 assert.deepEqual(errors,[]);console.log('PASS quote review '+width+'px: matches, timeline, opt-out, repeated refresh, search, unavailable, empty, stale, no overflow');await context.close()
 }
}finally{await browser.close()}
