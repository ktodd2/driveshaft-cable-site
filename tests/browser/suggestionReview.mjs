import assert from 'node:assert/strict'
import {suggestionCounts} from '../../src/lib/suggestionReview.js'
const {chromium}=await import(process.env.REPORT_PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch(process.env.REPORT_BROWSER?{executablePath:process.env.REPORT_BROWSER}:{})
const base='http://127.0.0.1:3028'
let writes=0
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[]
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
 let mode='full',held=null,delay=false
 let rows=[{id:'numeric',name:'Xzx random name',email:'buyer@example.test',message:'123456',status:'new',review_state:'unreviewed',review_revision:0,created_at:'bad'},
 {id:'buying',name:'مشتري',email:'buyer@test.com?bcc=evil@test.com',message:'كم السعر؟ Need 2',status:'new',review_state:'unreviewed',review_revision:0},
 {id:'markup',name:'Fixture',email:'other@example.test',message:'<script>window.pwned=1</script> https://a.test https://b.test https://c.test',status:'new',review_state:'unreviewed',review_revision:0},
 {id:'malformed',name:null,email:null,message:null,status:'archived',review_state:'unreviewed',review_revision:0}]
 const snapshot=()=>({rows:structuredClone(rows),counts:suggestionCounts(rows),checked_at:new Date(mode==='stale'?Date.now()-600000:Date.now()).toISOString()})
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort()
  if(url.pathname==='/__review'){
   const {name,args}=JSON.parse(route.request().postData())
   if(name==='get_suggestion_review'){
    if(delay){held={route,data:snapshot()};return}
    return route.fulfill({json:mode==='error'?{error:{code:'offline'}}:{data:mode==='empty'?{...snapshot(),rows:[],counts:suggestionCounts([])}:snapshot()}})
   }
   assert.equal(name,'review_suggestion');writes++
   const row=rows.find(r=>r.id===args.p_id)
   if(mode==='race'){row.review_revision++;row.name='Other admin edit';mode='full'}
   if(row.review_revision!==args.p_revision)return route.fulfill({json:{error:{code:'40001'}}})
   row.review_revision++
   if(args.p_action==='quarantine')row.review_state='quarantined'
   if(['restore','keep'].includes(args.p_action))row.review_state='kept'
   if(['read','new','archive'].includes(args.p_action))row.status=args.p_action==='archive'?'archived':args.p_action
   return route.fulfill({json:{data:null}})
  }
  if(url.pathname==='/src/lib/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase={};'})
  if(url.pathname.startsWith('/admin'))return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/@vite/client');await import('/tests/browser/suggestionReviewHarness.jsx');</script>`})
  return route.continue()
 })
 await page.goto(base+'/admin/suggestions');await page.getByText('3 matching submissions',{exact:true}).waitFor()
 const nav=page.getByRole('navigation',{name:'Admin navigation'})
 assert.equal(await nav.getByRole('link').count(),12);await nav.getByRole('link',{name:'Products',exact:true}).waitFor();await nav.getByRole('link',{name:'Sales',exact:true}).waitFor()
 await nav.getByRole('link',{name:'Suggestions 3 new',exact:true}).waitFor()
 assert.equal(await page.evaluate(()=>window.pwned),undefined)
 assert.equal(await page.locator('a[href*="bcc"]').count(),0)
 await page.getByRole('article',{name:'Submission numeric',exact:true}).getByRole('button',{name:'Review submission'}).click()
 await page.getByRole('button',{name:'Quarantine…'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(rows[0].review_state,'unreviewed')
 await page.getByRole('button',{name:'Quarantine…'}).click();await page.getByRole('button',{name:'Confirm quarantine'}).dblclick()
 await nav.getByRole('link',{name:'Suggestions 2 new',exact:true}).waitFor();assert.equal(rows[0].review_revision,1)
 await page.reload();await page.getByRole('button',{name:'Restore & keep'}).waitFor();assert.equal(rows[0].status,'new')
 await page.getByRole('button',{name:'Close details'}).click();await page.getByRole('button',{name:'Quarantine',exact:true}).click()
 await page.getByRole('article',{name:'Submission numeric',exact:true}).getByRole('button',{name:'Review submission'}).click()
 await page.getByRole('button',{name:'Restore & keep'}).click();await nav.getByRole('link',{name:'Suggestions 3 new',exact:true}).waitFor()
 assert.equal(await page.getByText('Needs context: numbers only;',{exact:false}).count(),0)
 mode='race';await page.getByRole('button',{name:'Mark read'}).click();await page.getByRole('alert').waitFor();assert.equal(rows[0].status,'new')
 assert.equal(await page.getByRole('button',{name:'Mark read'}).isDisabled(),true)
 await page.getByRole('button',{name:'Refresh suggestions'}).click();await page.getByRole('heading',{name:'Other admin edit'}).waitFor()
 await page.getByRole('button',{name:'Mark read'}).click();await nav.getByRole('link',{name:'Suggestions 2 new',exact:true}).waitFor()
 await page.getByRole('button',{name:'Close details'}).click();await page.getByRole('button',{name:'All submissions',exact:true}).click()
 await page.getByRole('searchbox',{name:'Search submissions'}).fill('كم السعر');await page.getByText('1 matching submissions',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Review submission'}).click();await page.goBack();await page.getByText('1 matching submissions',{exact:true}).waitFor();await page.goForward();await page.getByRole('button',{name:'Close details'}).waitFor()
 await page.getByRole('button',{name:'Close details'}).click();await page.getByRole('searchbox').fill('');await page.getByRole('button',{name:'Review hints & quarantine'}).click()
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.screenshot({path:`/tmp/suggestion-review-${width}.png`,fullPage:true})
 mode='error';await page.getByRole('button',{name:'Refresh suggestions'}).click();await page.getByRole('alert').waitFor();await nav.getByText('count unavailable',{exact:true}).waitFor()
 mode='empty';await page.getByRole('button',{name:'Refresh suggestions'}).click();await page.getByText('No submissions match this view and search.').waitFor()
 mode='stale';await page.getByRole('button',{name:'Refresh suggestions'}).click();await page.getByText('Snapshot may be stale;',{exact:false}).waitFor()
 await page.getByRole('article',{name:'Submission markup',exact:true}).getByRole('button',{name:'Review submission'}).click();assert.equal(await page.getByRole('button',{name:'Quarantine…'}).isDisabled(),true)
 mode='full';delay=true;await page.getByRole('button',{name:'Refresh suggestions'}).click();await page.getByRole('button',{name:'Loading…'}).waitFor();assert.equal(await page.getByRole('button',{name:'Quarantine…'}).isDisabled(),true)
 while(!held)await page.waitForTimeout(10)
 delay=false;await held.route.fulfill({json:{data:held.data}});await page.getByRole('button',{name:'Refresh suggestions'}).waitFor()
 assert.deepEqual(errors,[]);await context.close()
}console.log(`PASS desktop/mobile: all destinations, safe text/links, hints, quarantine/restore, cancel, duplicate clicks, reload persistence, status conflict, counts, search, back/forward, empty/error/stale/loading. ${writes} mocked writes; external traffic blocked.`)}finally{await browser.close()}
