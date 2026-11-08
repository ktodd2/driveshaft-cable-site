import {test} from 'node:test'
import assert from 'node:assert/strict'
import {activeSalesForProduct, combinedSalePercent, saleUnitPrice} from '../../supabase/functions/_shared/salePricing.js'
import {discountedLineAmounts} from '../../supabase/functions/_shared/discountAllocation.js'
const now=Date.parse('2026-11-08T00:00:00Z')
const sale=(id,extra={})=>({id,scope:'sitewide',discount_percent:10,is_active:true,starts_at:'2026-11-08T00:00:00Z',ends_at:'2026-11-15T00:00:00Z',...extra})
test('every eligible sale stacks once; scope and exact inclusive start/exclusive end remain enforced',()=>{
 const all=[sale('one'),sale('regular',{scope:'product',product_id:'1',discount_percent:20}),sale('one'),sale('off',{is_active:false}),sale('end',{ends_at:'2026-11-08T00:00:00Z'}),sale('future',{starts_at:'2026-11-09'}),sale('bad',{starts_at:'invalid'}),sale('invalid-scope',{scope:'invalid',product_id:'1'})]
 const eligible=activeSalesForProduct('1',all,now)
 assert.deepEqual(eligible.map(s=>s.id),['one','regular'])
 assert.equal(combinedSalePercent(eligible),30)
 assert.equal(saleUnitPrice(245,eligible),172)
 assert.equal(saleUnitPrice(245,[...eligible].reverse()),172)
 assert.equal(saleUnitPrice(350,activeSalesForProduct('2',all,now)),315)
 assert.equal(activeSalesForProduct('1',all,Date.parse('2026-11-15')).length,0)
})
test('invalid percentages cannot increase the price and excess savings stop at zero',()=>{
 const bad=[sale('nan',{discount_percent:NaN}),sale('infinite',{discount_percent:Infinity}),sale('negative',{discount_percent:-5}),sale('string',{discount_percent:'10'})]
 assert.equal(saleUnitPrice(300,activeSalesForProduct('1',bad,now)),300)
 assert.equal(saleUnitPrice(245,activeSalesForProduct('1',[sale('a',{discount_percent:75}),sale('b',{discount_percent:75})],now)),0)
 assert.throws(()=>saleUnitPrice(-1,[]),/Invalid product price/)
 assert.throws(()=>saleUnitPrice(Infinity,[]),/Invalid product price/)
 assert.deepEqual(discountedLineAmounts([{unitPrice:0,quantity:10}],0,0),[0])
})
