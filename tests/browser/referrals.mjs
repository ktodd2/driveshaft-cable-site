import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({executablePath:process.env.REPORT_BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const fixture={settings:{enabled:false,emails_enabled:false,auto_statements_enabled:false,statement_last_run_at:'2026-11-03T15:00:00Z',statement_last_counts:{sent:2,review:1}},partners:[{id:'partner-fixture',name:'Fixture Customer',code:'FIXTURE10',email:'referrer@invalid.test',status:'active',preference:'product',mailing_address:'123 Fixture Lane',balance:{pending:1000,available:2500,held:500,reserved:0,paid:1000,reversed:100}}],earnings:[{order_id:'20000000-0000-4000-8000-000000000011',partner_id:'partner-fixture',email:'buyer@invalid.test',sequence:11,rate_bps:100,base_cents:10000,merchandise_refund_cents:0,refunded_total_cents:500,available_at:'2026-11-10T12:00:00Z',refund_review:true}],redemptions:[{id:'redemption-fixture',partner_id:'partner-fixture',kind:'product',merchandise_cents:2000,shipping_cents:500,tax_cents:0,total_cents:2500,state:'requested',notes:'Fixture customer reply: retail product and shipping'}],statements:[{id:'statement-fixture',partner_id:'partner-fixture',month:'2026-11',balance:{available:2500}}]}
const origin=process.env.REFERRAL_FIXTURE_ORIGIN||'http://127.0.0.1:3017'
const mutations=[]
fixture.partners[0].buyer_discount_bps=500
fixture.partners[0].commission_tiers=[{through:1,bps:1000},{through:2,bps:500},{through:10,bps:200},{through:20,bps:100}]
fixture.partners[0].policy_revision=1
await fs.mkdir('docs/referrals/screenshots',{recursive:true})
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort()
  if(url.pathname==='/__signup'){const body=JSON.parse(route.request().postData());assert.equal(body.functionName,'referral-signup');assert.equal(body.token,'fixture-invite');if(body.action==='preview')return route.fulfill({json:{code:'FIXTURE10',revision:1,buyer_discount_bps:500,tiers:[{through:1,bps:1000},{through:2,bps:500},{through:10,bps:200},{through:20,bps:100}]}});assert.equal(body.accepted,true);assert.equal(body.revision,1);return route.fulfill({contentType:'application/json',body:JSON.stringify({code:'FIXTURE10',name:body.name})})}
  if(url.pathname==='/__referrals'){
   const request=JSON.parse(route.request().postData());assert.equal(request.name,'referral-admin')
   if(request.action==='list')return route.fulfill({contentType:'application/json',body:JSON.stringify(fixture)})
   mutations.push(request)
   if(request.action==='set-code-policy'){
    const partner=fixture.partners.find(p=>p.id===request.data.partner_id);assert.equal(request.data.expected_revision,partner.policy_revision)
    Object.assign(partner,{buyer_discount_bps:request.data.buyer_discount_bps,commission_tiers:request.data.tiers,policy_revision:partner.policy_revision+1})
    return route.fulfill({contentType:'application/json',body:JSON.stringify(partner)})
   }
   if(request.action==='create'){const code=request.data.codeMode==='generated'?'DC-ABCDEFGH':request.data.code.trim().toUpperCase();const id='created-'+mutations.length;fixture.partners.push({id,name:request.data.name,email:request.data.email,code,status:'invited',balance:{}});return route.fulfill({contentType:'application/json',body:JSON.stringify({id,code})})}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(request.action.startsWith('send-')?{error:'Referral email delivery is disabled for review'}:{id:'fixture'})})
  }
  if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:`export const supabase={functions:{invoke:async(name,options)=>{const r=await fetch('/__signup',{method:'POST',body:JSON.stringify({functionName:name,...options.body})});return {data:await r.json()}}}};`})
  if(url.pathname==='/__referral_test'||url.pathname==='/referral/signup')return route.fulfill({contentType:'text/html',body:`<script src="/referral-invite.js"></script><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/referralHarness.jsx');</script>`})
  return route.continue()
 })
 await page.goto(origin+'/__referral_test');await page.getByRole('heading',{name:'Referral rewards',exact:true}).waitFor()
 await page.getByText('statements need provider review.',{exact:false}).waitFor()
 await page.getByLabel('Customer / code').selectOption('partner-fixture')
 await page.getByText(width===1440?'11 / 1%':'Order 11 · 1%',{exact:true}).waitFor()
 const policyForm=page.getByRole('region',{name:'Code reward settings'})
 await policyForm.getByLabel('First-order buyer discount (%)').fill('7.25')
 await policyForm.getByLabel('Through paid order').last().fill('25')
 const beforePolicyReview=mutations.length
 await policyForm.getByRole('button',{name:'Review settings',exact:true}).click()
 assert.equal(mutations.length,beforePolicyReview,'reviewing code policy never mutates')
 await policyForm.getByText(/First eligible order discount: 7.25%/).waitFor()
 await page.screenshot({path:`docs/referrals/screenshots/code-policy-${width}.png`,fullPage:true})
 await policyForm.getByRole('button',{name:'Save code settings',exact:true}).click()
 await policyForm.getByText(/Orders after the final tier earn 0%/).waitFor()
 assert.equal(mutations.at(-1).action,'set-code-policy');assert.equal(mutations.at(-1).data.buyer_discount_bps,725);assert.equal(mutations.at(-1).data.tiers.at(-1).through,25)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.screenshot({path:`docs/referrals/screenshots/admin-${width}.png`,fullPage:true})
 const beforeReview=mutations.length;await page.getByRole('button',{name:'Review approval',exact:true}).click();assert.equal(mutations.length,beforeReview,'reviewing never mutates')
 await page.getByRole('button',{name:'Confirm action',exact:true}).click()
 await page.getByRole('button',{name:'Review manual email send'}).click();await page.getByRole('button',{name:'Confirm action',exact:true}).click()
 await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').textContent(),/disabled/)
 await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await page.getByLabel('Name',{exact:true}).fill('Custom Fixture');await page.getByLabel('Paid customer email').fill('custom-fixture@invalid.test');await page.getByLabel('Referral code',{exact:true}).fill(' custom-shop ');await page.getByRole('button',{name:'Add customer',exact:true}).click();await page.getByText('Created referral code CUSTOM-SHOP. No invitation sent.',{exact:true}).waitFor()
 const beforeGenerate=mutations.length;await page.getByRole('button',{name:'Generate code',exact:true}).click();const preview=await page.getByLabel('Referral code',{exact:true}).inputValue();assert.match(preview,/^DC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);assert.equal(mutations.length,beforeGenerate,'generation preview sends no request')
 await page.getByLabel('Name',{exact:true}).fill('Generated Fixture');await page.getByLabel('Paid customer email').fill('generated-fixture@invalid.test');await page.screenshot({path:`docs/referrals/screenshots/code-choices-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Add customer',exact:true}).click();await page.getByText('Created referral code DC-ABCDEFGH. No invitation sent.',{exact:true}).waitFor();assert.equal(mutations.at(-1).data.codeMode,'generated')
 await page.goto(origin+'/referral/signup#fixture-invite');await page.getByLabel('Full name').fill('Fixture Customer');await page.getByLabel('Mailing address').fill('123 Fixture Lane');await page.getByLabel('Preferred reward').selectOption('product');await page.getByRole('checkbox').check();assert.equal(new URL(page.url()).hash,'');await page.screenshot({path:`docs/referrals/screenshots/signup-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Complete signup'}).click();await page.getByText('Share it with new customers.',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);await context.close()
 }}finally{await browser.close()}
assert.equal(mutations.filter(m=>m.action==='approve').length,2)
assert.equal(mutations.filter(m=>m.action==='send-statement').length,2)
console.log('PASS isolated headless desktop/mobile: balances, tier row, review-before-approve, disabled sends, no horizontal overflow; no external network or user browser access')
