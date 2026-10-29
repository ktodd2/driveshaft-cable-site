// Run with TRACKING_PLAYWRIGHT_MODULE pointing to a locally installed playwright module.
// Vite must run at 127.0.0.1:3000. All non-local requests are blocked.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.TRACKING_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const mock = `
window.fixture = { calls: [], updates: 0, fail: true, rows: ['Alpha','Beta'].map((name,i)=>({ id: 'order-'+i, name, email: name+'@example.test', status:'confirmed', payment_status:'paid', created_at:new Date().toISOString(), updated_at:'old', total_cents:1000, items:[], tracking_number:null })) };
export const supabase = {
 auth:{ getSession:async()=>({data:{session:{user:{id:'offline'}}}}) },
 from(table) { let id, patch; const q={ select:()=>q, eq:(key,value)=>{if(key==='id') id=value; return q}, order:()=>q,
 update:p=>{patch=p; return q}, single:async()=>{if(table==='product_inventory')return {data:{stock_quantity:100}}; let row=window.fixture.rows.find(r=>r.id===id); if(patch){Object.assign(row,patch);window.fixture.updates++}; return {data:{...row}}},
 then:fn=>Promise.resolve({data:table==='orders'?window.fixture.rows.map(r=>({...r})):[]}).then(fn) }; return q },
 functions:{ invoke:async(name, {body})=>{if(name!=='send-tracking-email-v2')throw Error('Wrong endpoint');window.fixture.calls.push(body); await new Promise(r=>setTimeout(r,100)); if(window.fixture.fail)throw Error('ambiguous'); return {data:{success:true,emailId:'fixture-id'}}} }
}
`
try {
 for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  const context = await browser.newContext({ viewport, serviceWorkers:'block' })
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors=[]
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)})
  await page.route('**/*', async route => {
   const url = new URL(route.request().url())
   if (url.hostname !== '127.0.0.1') return route.abort()
   if (url.pathname === '/src/lib/supabase.js') return route.fulfill({contentType:'text/javascript',body:mock})
   if (url.pathname === '/__tracking_test') return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
await import('/@vite/client'); await import('/tests/browser/trackingHarness.jsx');
</script>`})
   return route.continue()
  })
  await page.goto('http://127.0.0.1:3000/__tracking_test')
  await page.getByText('Alpha',{exact:true}).click()
  const input=page.getByPlaceholder('Enter tracking number')
  await input.fill('draft-A')
  await page.getByText('Beta',{exact:true}).first().click()
  await page.waitForFunction(()=>document.querySelector('input[placeholder="Enter tracking number"]')?.value === '')
  assert.equal(await input.inputValue(),'')
  await page.getByText('Alpha',{exact:true}).first().click()
  await input.fill('TRACK-A')
  await page.getByRole('button',{name:'Save & Email Customer',exact:true}).dblclick()
  await page.getByRole('status').filter({hasText:'outcome unconfirmed'}).waitFor()
  assert.equal(await page.evaluate(()=>window.fixture.updates),1)
  assert.equal(await page.evaluate(()=>window.fixture.calls.length),1)
  await page.getByRole('button',{name:'Update tracking',exact:true}).click()
  await input.fill('cancelled-draft')
  await page.getByRole('button',{name:'Cancel tracking edit'}).click()
  assert.equal(await input.count(),0)
  await page.getByText('Beta',{exact:true}).first().click()
  assert.equal(await page.getByRole('status').count(),0)
  // Alpha is now shipped and filtered out; choose All Orders.
  await page.getByRole('button',{name:'All',exact:true}).click()
  await page.getByText('Alpha',{exact:true}).first().click()
  await page.evaluate(()=>window.fixture.fail=false)
  await page.getByRole('button',{name:'Retry same tracking email'}).click()
  await page.getByRole('status').filter({hasText:'accepted by provider'}).waitFor()
  const calls=await page.evaluate(()=>window.fixture.calls)
  assert.deepEqual(calls[0],calls[1]); assert.equal(await page.evaluate(()=>window.fixture.updates),1)
  await page.screenshot({path:'/tmp/tracking-'+viewport.width+'.png',fullPage:true})
  assert.deepEqual(errors,[])
  console.log('PASS mocked browser '+viewport.width+'x'+viewport.height+' save, failure, retry, cancellation, switching, double-click')
  await context.close()
 }
} finally { await browser.close() }
