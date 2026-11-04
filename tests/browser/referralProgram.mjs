// Built/prerendered public page with offline catalog responses. No live API or user browser.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {DEFAULT_REFERRAL_POLICY,referralPolicyRate} from '../../supabase/functions/_shared/referralPolicy.js'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE||'playwright')
const origin=process.env.REFERRAL_PUBLIC_ORIGIN||'http://127.0.0.1:3018'
const output=process.env.REFERRAL_SCREENSHOT_DIR||'/tmp/referral-public-screenshots'
const catalog=JSON.parse(await fs.readFile('tests/fixtures/referralCatalog.json','utf8'))
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const results=[]
await fs.mkdir(output,{recursive:true})
try{
 for(const width of [1440,1280,1024,768,640,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'})
  const page=await context.newPage(),errors=[],writes=[]
  page.setDefaultTimeout(15000)
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url())
   if(url.hostname==='fixture.invalid'){
    if(req.method()!=='GET'){writes.push(url.pathname);return route.abort()}
    const rows=url.pathname.endsWith('/products')?catalog.products:url.pathname.endsWith('/product_inventory')?catalog.inventory:[]
    return route.fulfill({json:rows})
   }
   if(url.hostname!=='127.0.0.1')return route.abort()
   assert.equal(req.method(),'GET','public content must not submit mutations')
   return route.continue()
  })
  const response=await page.goto(origin+'/referrals')
  assert.equal(response.status(),200)
  await page.getByRole('heading',{level:1,name:'EARN CASH OR STORE CREDIT.'}).waitFor()
  assert.equal(await page.getByRole('heading',{level:1}).count(),1)
  const copy=await page.locator('article').innerText()
  for(const required of ['past customer to qualify','first-ever paid website retail order','5%','10%','Orders 3–10','Orders 11–20','commissions end after that customer’s 20th paid order','excluding tax and shipping','A $50 check uses $100','Product credit can cover shipping','kurtis@k-todd.com','DM on social media','Seven days']){
   assert.ok(copy.toLowerCase().includes(required.toLowerCase()),required)
  }
  assert.equal(await page.locator('article dl > div').count(),4,'only four earning tiers; no extra after-20 row')
  assert.deepEqual(await page.locator('article dl dd').allTextContents(),DEFAULT_REFERRAL_POLICY.tiers.map(tier=>`${tier.bps/100}%`),'public rates match unchanged code defaults')
  assert.equal(referralPolicyRate(20),100);assert.equal(referralPolicyRate(21),0)
  const email=page.getByRole('link',{name:'Request a referral code'})
  assert.match(await email.getAttribute('href'),/^mailto:kurtis@k-todd\.com\?/)
  assert.equal(await page.locator('article form').count(),0,'signup stays contact/invitation based')
  await page.waitForFunction(()=>document.querySelector('main').style.paddingTop!=='0px')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`)
  const heading=await page.getByRole('heading',{level:1}).boundingBox(),nav=await page.locator('body > #root header').first().boundingBox()
  assert.ok(heading.y>=nav.y+nav.height,`heading hidden behind fixed header at ${width}`)
  if(width>=1280){
   const primary=page.getByRole('navigation',{name:'Primary'})
   assert.equal(await primary.getByRole('link',{name:'Referrals',exact:true}).getAttribute('aria-current'),'page')
   const box=await primary.boundingBox();assert.ok(box.x+box.width<=width,`desktop navigation clipped at ${width}`)
  }else{
   await page.getByRole('button',{name:'Open menu',exact:true}).click()
   const navLink=page.locator('#mobile-nav').getByRole('link',{name:'Referrals',exact:true})
   assert.equal(await navLink.getAttribute('aria-current'),'page')
   await page.keyboard.press('Escape')
   await page.getByRole('button',{name:'Open menu',exact:true}).waitFor()
   assert.equal(await page.getByRole('button',{name:'Open menu',exact:true}).evaluate(el=>document.activeElement===el),true,'Escape restores focus')
  }
  await page.keyboard.press('Tab')
  await email.focus()
  assert.equal(await email.evaluate(el=>{const s=getComputedStyle(el);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2}),true,'visible keyboard focus')
  assert.equal(await email.evaluate(el=>el.getBoundingClientRect().height>=44),true)
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://driveshaftcable.com/referrals')
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'index, follow')
  await page.screenshot({path:`${output}/referral-program-${width}.png`,fullPage:true})
  if(width===1440||width===390){
   await page.goto(origin+'/about')
   if(width===390){await page.getByRole('button',{name:'Open menu',exact:true}).focus();await page.keyboard.press('Enter')}
   const navLink=width===390?page.locator('#mobile-nav').getByRole('link',{name:'Referrals',exact:true}):page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Referrals',exact:true})
   await navLink.focus();await page.keyboard.press('Enter');await page.getByRole('heading',{level:1,name:'EARN CASH OR STORE CREDIT.'}).waitFor()
   assert.equal(new URL(page.url()).pathname,'/referrals')
   assert.equal(await page.getByRole('contentinfo').getByRole('link',{name:'Referral Program',exact:true}).getAttribute('href'),'/referrals')
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[])
  results.push({width,pass:true,h1:1,overflow:false,keyboard:true,mutations:0})
  await context.close()
 }
}finally{await browser.close()}
await fs.writeFile(output+'/results.json',JSON.stringify(results,null,2)+'\n')
console.log('PASS public referral page: terms, four tiers, reward choices, contact-only signup, desktop/mobile navigation, keyboard focus/Escape, SEO and zero mutations at seven widths (320–1440). No external traffic or user browser.')
