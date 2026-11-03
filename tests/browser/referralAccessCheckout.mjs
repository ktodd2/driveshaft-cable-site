import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const orderId='10000000-0000-4000-8000-000000000001',secret='pi_fixture_secret_fixture'
const product={id:'1',name:'Fixture Cable',slug:'driveshaft-cable',sku:'FIXTURE',base_price_cents:300,tiers:[],is_active:true,is_storefront:true,min_order_quantity:10,order_quantity_step:1,images:[],short_description:'Fixture',description:'Fixture',specs:{},applications:[],features:[]}
const cart={state:{items:[{productId:'1',name:'Fixture Cable',quantity:10,price:300}],recoveryDiscountCode:null,recoveryEmail:null},version:0}
try{for(const width of [1440,390]){
 let anonymousOrderCalls=0,lose=true;const creates=[],quotes=[],errors=[]
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage()
 await context.addInitScript(data=>{if(!sessionStorage.getItem('seeded-access-cart')){localStorage.setItem('ktodd-cart',JSON.stringify(data));sessionStorage.setItem('seeded-access-cart','yes')}},cart)
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),path=url.pathname
  if(url.hostname!=='127.0.0.1')return route.abort()
  if(path.includes('@stripe_stripe-js'))return route.fulfill({contentType:'text/javascript',body:'export const loadStripe=()=>Promise.resolve(null)'})
  if(path.startsWith('/rest/v1/')){
   const table=path.split('/').pop()
   if(table==='orders'){anonymousOrderCalls++;return route.fulfill({status:403,json:{message:'permission denied'}})}
   if(table==='products')return route.fulfill({json:[product]})
   if(table==='product_inventory')return route.fulfill({json:[{product_id:'1',stock_quantity:1000,total_quantity:1000}]})
   return route.fulfill({json:[]})
  }
  if(path==='/functions/v1/quote-checkout'){
   const input=route.request().postDataJSON();quotes.push(input);const repeat=false,tax=input.customer.zip==='77001'?200:0,referral=input.referralCode?150:0
   return route.fulfill({json:{subtotalCents:3000,discountCents:(repeat?300:0)+referral,shippingCents:2000,taxCents:tax,totalCents:5000-(repeat?300:0)-referral+tax,referralDiscountCents:referral,referralDiscountBps:referral?500:0,discountSource:referral?'referral':repeat?'loyalty':null,repeat,taxQuoted:input.customer.zip==='77001'}})
  }
  if(path==='/functions/v1/resume-secure-checkout'){
   const input=route.request().postDataJSON();assert.equal(input.checkoutId,creates[0].checkoutId);assert.equal(input.checkoutToken,creates[0].checkoutToken)
   return route.fulfill({json:{orderId,clientSecret:secret,status:'requires_payment_method',checkout:{customer:creates[0].customer,items:[{productId:'1',name:'Frozen Fixture Cable',quantity:10,price:300}],referralCode:'SHOP-10',discountCode:null,pricing:{subtotalCents:3000,discountCents:150,shippingCents:2000,taxCents:200,totalCents:5050,discountSource:'referral',taxQuoted:true}}}})
  }
  if(path==='/functions/v1/create-secure-checkout'){
   const input=route.request().postDataJSON();creates.push(input)
   assert.equal(input.amount,5050);assert.equal(input.customer.email,'new@invalid.test');assert.ok(/^[a-f0-9]{64}$/.test(input.checkoutToken));assert.ok(input.checkoutId);assert.equal(input.referralCode,'SHOP-10');assert.equal(input.discountCode,null);assert.equal(input.orderId,undefined);assert.equal(input.payment_status,undefined)
   if(lose){lose=false;return route.fulfill({status:503,json:{error:'Fixture response lost; retry this checkout'}})}
   return route.fulfill({json:{orderId,clientSecret:secret,status:'requires_payment_method'}})
  }
  if(path==='/functions/v1/verify-purchase'){
   const input=route.request().postDataJSON();assert.equal(input.orderId,orderId);assert.equal(input.clientSecret,secret)
   return route.fulfill({json:{status:'paid',purchase:null,order:{subtotal_cents:3000,discount_cents:150,shipping_cents:2000,tax_cents:200,total_cents:5050}}})
  }
  return route.continue()
 })
 await page.goto('http://127.0.0.1:3018/checkout')
 await page.getByLabel('Email *',{exact:true}).fill('new@invalid.test')
 await page.getByLabel('Referral code (optional)',{exact:true}).fill('shop-10')
 await page.getByText('Using this code lets the referrer see your name',{exact:false}).waitFor()
 assert.match(await page.getByText('Using this code lets the referrer see your name',{exact:false}).textContent(),/this order and future orders using the same email/)
 await page.getByLabel('Full Name *',{exact:true}).fill('Fixture Buyer')
 await page.getByLabel('Phone *',{exact:true}).fill('5551234567')
 await page.getByLabel('Address *',{exact:true}).fill('123 Fixture Lane')
 await page.getByLabel('City *',{exact:true}).fill('Houston')
 await page.getByLabel('State *',{exact:true}).fill('TX')
 await page.getByLabel('ZIP Code *',{exact:true}).fill('77001')
 await page.waitForFunction(()=>document.body.textContent.includes('$50.50'))
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100)
 await page.screenshot({path:`docs/integration/screenshots/referral-code-${width}.png`,fullPage:true})
 await page.getByRole('button',{name:'Continue to Payment',exact:true}).click()
 await page.getByText('Fixture response lost; retry this checkout',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Continue to Payment',exact:true}).click()
 await page.getByRole('heading',{name:'PAYMENT',exact:true}).waitFor()
 assert.equal(creates.length,2);assert.equal(creates[0].checkoutId,creates[1].checkoutId);assert.equal(creates[0].checkoutToken,creates[1].checkoutToken)
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100)
 await page.screenshot({path:`docs/integration/screenshots/checkout-${width}.png`,fullPage:true})
 // Reload drops globals and form state; private capability resumes the frozen checkout.
 await page.reload();await page.getByRole('button',{name:'Resume / check payment',exact:true}).click()
 await page.getByRole('heading',{name:'PAYMENT',exact:true}).waitFor();await page.getByText('Frozen Fixture Cable',{exact:true}).waitFor()
 assert.equal(creates.length,2,'resume never creates another checkout');assert.equal(await page.getByRole('button',{name:'Pay $50.50',exact:true}).count(),1)
 // Full navigation simulates a Stripe/3DS return: globals disappear, tab-private capability remains.
 await page.goto(`http://127.0.0.1:3018/checkout/success?order=${orderId}`)
 await page.getByRole('heading',{name:'ORDER CONFIRMED!',exact:false}).waitFor()
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('ktodd-checkout-draft')),null)
 assert.equal(anonymousOrderCalls,0);assert.ok(quotes.length>0)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100)
 await page.screenshot({path:`docs/integration/screenshots/confirmation-${width}.png`,fullPage:true})
 assert.deepEqual(errors,[])
 await context.close()
 }}finally{await browser.close()}
console.log('PASS composed referral newbuyer desktop/mobile: actual checkout, server quote/loyalty, lost-response retry identity, full Stripe return, zero browser orders requests, no external calls or page errors')
