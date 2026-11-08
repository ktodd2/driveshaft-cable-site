import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {runInNewContext} from 'node:vm'
const compiled=await build({entryPoints:['supabase/functions/_shared/checkoutPricing.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'offline-supabase',setup(b){b.onResolve({filter:/^https:/},args=>({path:args.path,namespace:'offline'}));b.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:'export const createClient=()=>{throw Error("No network")};export default class Stripe{}',loader:'js'}))}}]})
const module={exports:{}};runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,console:{warn(){}},Date,Error,Map,Math,Number});const {priceCheckout}=module.exports
function fixture({repeat=false,lookupError=false,product='cable',stock=10000,sale=false,taxError=false}={}){
 const products={cable:{id:'cable',name:'Catalog Cable',is_active:true,is_storefront:true,base_price_cents:300,tiers:[{min:200,price:245},{min:100,price:270}],min_order_quantity:10,order_quantity_step:1},cutter:{id:'cutter',name:'Cutter',is_active:true,is_storefront:true,base_price_cents:2500,tiers:[],min_order_quantity:1,order_quantity_step:1}}
 const calls=[],taxes=[]
 const db={rpc:async(name,args)=>{calls.push([name,args]);assert.equal(name,'checkout_repeat_customer');return lookupError?{error:{message:'offline'}}:{data:repeat}},from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},lte(){return q},gt(){return q},single:async()=>({data:table==='products'?products[filters.find(x=>x[0]==='id')?.[1]||product]:{stock_quantity:stock}}),maybeSingle:async()=>({data:null}),then(resolve){assert.equal(table,'sales');return Promise.resolve({data:sale?[{id:'sale',scope:'sitewide',discount_percent:10,is_active:true,starts_at:'2000-01-01',ends_at:'2999-01-01'}]:[]}).then(resolve)}};return q}}
 const stripe={tax:{calculations:{create:async params=>{taxes.push(params);if(taxError)throw Error('offline');return {tax_amount_exclusive:200,id:'taxcalc_fixture'}}}}}
 const input={items:[{productId:product,quantity:product==='cutter'?1:200}],customer:{email:'fixture@invalid.test',address1:'123 Fixture',city:'Houston',state:'TX',zip:'77001',country:'US'},discountCode:'WELCOME5'}
 return {db,stripe,input,calls,taxes,products}
}
test('actual server price preserves volume tiers, sales, loyalty/code stacking and pre-loyalty shipping threshold',async()=>{
 const f=fixture({repeat:true,sale:true});const p=await priceCheckout(f.db,f.stripe,f.input)
 assert.equal(p.lines[0].unitPrice,221);assert.equal(p.subtotalCents,44200);assert.equal(p.discountCents,6630);assert.equal(p.discountSource,'combined');assert.equal(p.shippingCents,2000);assert.equal(p.totalCents,39770)
 f.input.items[0].quantity=300;const large=await priceCheckout(f.db,f.stripe,f.input);assert.equal(large.subtotalCents,66300);assert.equal(large.shippingCents,0);assert.equal(large.totalCents,56555)
 assert.ok(f.calls.every(([name])=>name==='checkout_repeat_customer'),'pricing API requests only minimal membership boolean')
})
test('new customer code remains five percent and shipping/tax are separate from discounted merchandise',async()=>{
 const f=fixture({product:'cutter'});const p=await priceCheckout(f.db,f.stripe,f.input)
 assert.equal(p.subtotalCents,2500);assert.equal(p.discountCents,125);assert.equal(p.discountSource,'code');assert.equal(p.shippingCents,2000);assert.equal(p.taxCents,200);assert.equal(p.totalCents,4575)
 assert.equal(f.taxes[0].line_items[0].amount,2375)
})
test('stock, hidden products, invalid quantities and unavailable loyalty lookup fail before payment',async()=>{
 const f=fixture({lookupError:true});await assert.rejects(()=>priceCheckout(f.db,f.stripe,f.input),/verify pricing/)
 const empty=fixture({stock:0});await assert.rejects(()=>priceCheckout(empty.db,empty.stripe,empty.input),/quantities/)
 const hidden=fixture();hidden.products.cable.is_storefront=false;await assert.rejects(()=>priceCheckout(hidden.db,hidden.stripe,hidden.input),/unavailable/)
 const partial=fixture({stock:3});partial.input.items[0].quantity=3;assert.equal((await priceCheckout(partial.db,partial.stripe,partial.input)).lines[0].quantity,3,'existing below-minimum remaining stock purchase remains possible')
})
test('quote tax failures surface while payment preparation retains the existing explicit fail-open policy',async()=>{
 const f=fixture({taxError:true});await assert.rejects(()=>priceCheckout(f.db,f.stripe,f.input),/calculate tax/)
 const p=await priceCheckout(f.db,f.stripe,f.input,{failTaxOpen:true});assert.equal(p.taxCents,0);assert.equal(p.taxCalculationId,null)
})

test('sale, loyalty, coupon and referral all stack, retaining tax/shipping and a zero floor',async()=>{
 const f=fixture({repeat:true,sale:true})
 f.input.referralCode='FIXTURE'
 const original=f.db.rpc
 f.db.rpc=async(name,args)=>name==='referral_quote_code'?{data:{buyer_discount_bps:500}}:original(name,args)
 const p=await priceCheckout(f.db,f.stripe,f.input,{referralEnabled:true})
 assert.equal(p.subtotalCents,44200)
 assert.equal(p.baseDiscountCents,6630)
 assert.equal(p.referralDiscountCents,2210)
 assert.equal(p.discountCents,8840)
 assert.equal(p.totalCents,37560)
 f.db.rpc=async(name,args)=>name==='referral_quote_code'?{data:{buyer_discount_bps:10000}}:original(name,args)
 const capped=await priceCheckout(f.db,f.stripe,f.input,{referralEnabled:true})
 assert.equal(capped.discountCents,capped.subtotalCents)
 assert.equal(capped.totalCents,capped.shippingCents+capped.taxCents)
 assert.equal(f.taxes.at(-1).line_items.reduce((sum,l)=>sum+l.amount,0),0)
})

test('used or invalid coupons do not add savings to loyalty',async()=>{
 for(const used of [true,false]){
  const f=fixture({repeat:true,sale:true})
  if(used){const from=f.db.from;f.db.from=table=>{const q=from(table);if(table==='discount_redemptions')q.maybeSingle=async()=>({data:{id:'used'}});return q}}
  else f.input.discountCode='INVALID'
  const p=await priceCheckout(f.db,f.stripe,f.input)
  assert.equal(p.discountCents,4420)
  assert.equal(p.discountSource,'loyalty')
  assert.equal(p.discountCode,null)
 }
})
