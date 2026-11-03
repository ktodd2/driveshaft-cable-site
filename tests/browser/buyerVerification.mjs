// Headless browser ownership isolation against actual local pricing/verification SQL.
// Mail, bot challenge and Stripe transports are fixtures; all external requests blocked.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {commerceFixture} from '../fixtures/integrationCommerceDb.mjs'
import {normalizeCheckoutInput,createSecurePayment} from '../../supabase/functions/_shared/secureCheckout.js'
import {requestBuyerVerification,consumeBuyerVerification} from '../../supabase/functions/_shared/buyerVerification.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const origin='http://127.0.0.1:3019',mailbox=[],responses=[],consumes=[],creates=[]
const env={get:key=>({BUYER_EMAIL_VERIFICATION_ENABLED:'true',BUYER_VERIFICATION_EMAILS_ENABLED:'true',RESEND_API_KEY:'fixture-only',SUPABASE_URL:'https://twrihhyfvomqiqbxkitc.supabase.co',BUYER_VERIFICATION_CHALLENGE_SECRET:'fixture-real-key'}[key])}
const f=await commerceFixture({policyRuntime:true,emailVerification:true})
await f.sql.exec('reset role');await f.sql.query("insert into orders(email,name,payment_status,status,payment_method,items,total_cents,stock_decremented)values('owner@invalid.test','Owner','paid','confirmed','cash','[]',100,true)");await f.sql.exec('set role service_role;update referral_settings set enabled=true,buyer_verification_emails_enabled=true')
const partner=await f.db.rpc('referral_create_partner',{p_actor:f.owner,p_email:'owner@invalid.test',p_name:'Owner',p_code:'VERIFY-CODE',p_generate:false});assert.ifError(partner.error);await f.sql.query("update referral_partners set status='active' where id=$1",[partner.data.id])
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const product={id:'1',name:'Fixture Cable',slug:'driveshaft-cable',sku:'FIXTURE',base_price_cents:500,tiers:[],is_active:true,is_storefront:true,min_order_quantity:10,order_quantity_step:1,images:[],specs:{},features:[],applications:[]}
const cart={state:{items:[{productId:'1',name:'Fixture Cable',quantity:10,price:500}],recoveryDiscountCode:null,recoveryEmail:null},version:0}
const errors=[]
async function context(width=1440,{blockedStorage=false,blockedScrubber=false}={}){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'})
 await context.addInitScript(data=>{
  if(window.location.origin!=='http://127.0.0.1:3019')return
  if(!localStorage.getItem('ktodd-cart'))localStorage.setItem('ktodd-cart',JSON.stringify(data))
  window.turnstile={render:(_node,options)=>{queueMicrotask(()=>options.callback('fixture-challenge-'+options.cData));return 'fixture-widget'},remove(){}}
 },cart)
 if(blockedStorage)await context.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('Fixture storage blocked')}})})
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)))
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),path=url.pathname
  if(url.origin!==origin)return route.abort()
  if(blockedScrubber&&path==='/buyer-email-verification.js')return route.abort()
  if(path.includes('@stripe_stripe-js'))return route.fulfill({contentType:'text/javascript',body:'export const loadStripe=()=>Promise.resolve(null)'})
  if(path.startsWith('/rest/v1/')){const table=path.split('/').pop();return route.fulfill({json:table==='products'?[product]:table==='product_inventory'?[{product_id:'1',stock_quantity:100000}]:[]})}
  if(path==='/functions/v1/quote-checkout'){
   try{const quote=await f.price(normalizeCheckoutInput(route.request().postDataJSON(),{complete:false}));return route.fulfill({json:{...quote,referralPolicy:undefined,taxCalculationId:undefined,taxQuoted:true}})}catch{return route.fulfill({status:409,json:{error:'Fixture price unavailable'}})}
  }
  if(path==='/functions/v1/buyer-email-verification'){
   const input=route.request().postDataJSON();let result
   if(input.action==='request')result=await requestBuyerVerification(f.db,input,env,{challengeTransport:async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.response,'fixture-challenge-'+body.idempotency_key);return Response.json({success:true,hostname:'driveshaftcable.com',action:'buyer-checkout-verification',cdata:body.idempotency_key,challenge_ts:new Date().toISOString()})},emailTransport:async(_url,options)=>{const email=JSON.parse(options.body),token=email.text.match(/#([a-f0-9]{64})/)[1];mailbox.push({email:email.to,token});return Response.json({id:'fixture-mail-'+mailbox.length})}})
   else{consumes.push(input);result=await consumeBuyerVerification(f.db,input,env)}
   responses.push(result.body);return route.fulfill({status:result.status,json:result.body})
  }
  if(path==='/functions/v1/create-secure-checkout'){
   const input=route.request().postDataJSON();creates.push(input)
   try{const result=await createSecurePayment(f.db,f.stripe,input,f.price,{referralEnabled:true});return route.fulfill({status:result.status,json:result.body})}catch(error){return route.fulfill({status:409,json:{error:error.message,verificationRequired:true}})}
  }
  if(path.startsWith('/functions/v1/'))return route.fulfill({status:409,json:{error:'Unrelated fixture function disabled'}})
  return route.continue()
 })
 return context
}
async function form(page,email,code=''){
 await page.goto(origin+'/checkout');await page.getByLabel('Email *',{exact:true}).fill(email)
 await page.getByLabel('Full Name *',{exact:true}).fill('Synthetic Buyer');await page.getByLabel('Phone *',{exact:true}).fill('5551234567')
 await page.getByLabel('Address *',{exact:true}).fill('123 Fixture Lane');await page.getByLabel('City *',{exact:true}).fill('Houston');await page.getByLabel('State *',{exact:true}).fill('TX');await page.getByLabel('ZIP Code *',{exact:true}).fill('77001')
 if(code)await page.getByLabel('Referral code (optional)',{exact:true}).fill(code)
 await page.getByRole('heading',{name:'Verify your email before your first checkout',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Continue to Payment',exact:true}).isDisabled(),true)
 await page.getByRole('button',{name:'Email verification link',exact:true}).click();await page.getByText('Check your email for a verification link.',{exact:false}).waitFor()
}
try{
 await fs.mkdir('docs/referrals/screenshots',{recursive:true})
 const attackerContext=await context(),attacker=await attackerContext.newPage();await form(attacker,'receiver@invalid.test','VERIFY-CODE')
 assert.equal(mailbox.length,1);assert.ok(!JSON.stringify(responses).includes(mailbox[0].token))
 const receiverContext=await context(390),receiver=await receiverContext.newPage();await receiver.goto(origin+'/checkout/verify-email#'+mailbox[0].token)
 await receiver.getByRole('button',{name:'Verify email',exact:true}).waitFor();assert.equal(new URL(receiver.url()).hash,'');assert.equal(consumes.length,0)
 assert.equal((await f.sql.query('select count(*)::int n from buyer_verification_proofs')).rows[0].n,0,'opening email alone mints no proof')
 await receiver.screenshot({path:'docs/referrals/screenshots/email-confirm-390.png',fullPage:true})
 await receiver.getByRole('button',{name:'Verify email',exact:true}).click();await receiver.getByText('Verified receiver@invalid.test in this browser for one hour.',{exact:true}).waitFor()
 assert.equal(await attacker.evaluate(()=>sessionStorage.getItem('dsc-buyer-email-proof-v1')),null,'different browser requester receives no proof')
 assert.equal(await attacker.getByRole('button',{name:'Continue to Payment',exact:true}).isDisabled(),true)
 assert.equal(f.intents.size,0);assert.equal((await f.sql.query('select count(*)::int n from referral_first_checkouts')).rows[0].n,0)
 await receiver.evaluate(()=>window.__continuationFixture=true)
 await receiver.getByRole('link',{name:'Continue to checkout',exact:true}).click();await receiver.getByLabel('Email *',{exact:true}).waitFor();assert.equal(await receiver.getByLabel('Email *',{exact:true}).inputValue(),'receiver@invalid.test','cross-browser receiver can continue in its own browser')
 assert.equal(await receiver.evaluate(()=>window.__continuationFixture),undefined,'persisted proof uses full navigation to restore ordinary checkout analytics')
 const originalContext=await context(),original=await originalContext.newPage();await form(original,'same-browser@invalid.test')
 const second=mailbox.find(mail=>mail.email==='same-browser@invalid.test');assert.ok(second)
 const emailTab=await originalContext.newPage();await emailTab.goto(origin+'/checkout/verify-email#'+second.token);await emailTab.getByRole('button',{name:'Verify email',exact:true}).click()
 await original.getByText('Email verified: same-browser@invalid.test',{exact:true}).waitFor()
 await original.screenshot({path:'docs/referrals/screenshots/email-verified-1440.png',fullPage:true})
 await original.getByRole('button',{name:'Continue to Payment',exact:true}).click();await original.getByRole('heading',{name:'PAYMENT',exact:true}).waitFor()
 assert.equal(f.intents.size,1);assert.equal(creates.length,1);assert.match(creates[0].buyerVerificationToken,/^[a-f0-9]{64}$/)
 assert.equal((await f.sql.query("select count(*)::int n from referral_first_checkouts where email='same-browser@invalid.test'")).rows[0].n,1)
 const fallbackRequester=await attackerContext.newPage();await form(fallbackRequester,'storage-blocked@invalid.test')
 const fallbackMail=mailbox.find(mail=>mail.email==='storage-blocked@invalid.test'),fallbackContext=await context(390,{blockedStorage:true,blockedScrubber:true}),fallback=await fallbackContext.newPage()
 await fallback.goto(origin+'/checkout/verify-email#'+fallbackMail.token);await fallback.getByRole('button',{name:'Verify email',exact:true}).waitFor()
 assert.equal(new URL(fallback.url()).hash,'','React fallback scrubs the fragment if the external scrubber fails')
 assert.equal(await fallback.evaluate(()=>typeof window.gtag),'undefined','private route blocks analytics independently of scrubber asset')
 await fallback.getByRole('button',{name:'Verify email',exact:true}).click();await fallback.getByText('Keep this tab open while checking out.',{exact:false}).waitFor()
 await fallback.evaluate(()=>window.__continuationFixture=true)
 await fallback.getByRole('link',{name:'Continue to checkout',exact:true}).click();await fallback.getByLabel('Email *',{exact:true}).waitFor()
 assert.equal(await fallback.getByLabel('Email *',{exact:true}).inputValue(),'storage-blocked@invalid.test')
 assert.equal(await fallback.evaluate(()=>window.__continuationFixture),true,'blocked storage keeps the receiver proof through SPA navigation')
 await fallback.getByText('Email verified: storage-blocked@invalid.test',{exact:true}).waitFor()
 assert.deepEqual(errors,[])
 await Promise.all([attackerContext.close(),receiverContext.close(),originalContext.close(),fallbackContext.close()])
 console.log('PASS isolated buyer verification browser: explicit confirmation, fragment scrub even with asset failure, requester isolation, native same-browser BroadcastChannel handoff, full-navigation continuation, blocked-storage fallback and proof-gated uncoded checkout; no external traffic.')
}finally{await browser.close();await f.sql.close()}
