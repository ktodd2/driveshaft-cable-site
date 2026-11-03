import {test} from 'node:test'
import assert from 'node:assert/strict'
import {discountedLineAmounts} from '../../supabase/functions/_shared/discountAllocation.js'
test('stacked discount tax allocation preserves cents exactly and resolves ties deterministically',()=>{
 const lines=[1,1,1].map(unitPrice=>({unitPrice,quantity:1}))
 assert.deepEqual(discountedLineAmounts(lines,3,1),[1,1,0])
 assert.deepEqual(discountedLineAmounts(lines,3,2),[1,0,0])
 assert.deepEqual(discountedLineAmounts(lines,3,3),[0,0,0])
 for(let discount=0;discount<=1000;discount++){
  const amounts=discountedLineAmounts([{unitPrice:97,quantity:3},{unitPrice:109,quantity:2},{unitPrice:491,quantity:1}],1000,discount)
  assert.equal(amounts.reduce((a,b)=>a+b,0),1000-discount)
  amounts.forEach((amount,i)=>assert.ok(amount>=0&&amount<=[291,218,491][i]))
 }
})
test('invalid monetary inputs fail before tax provider access',()=>{
 for(const values of [[0,0],[3,-1],[3,4],[3,0.5],[4,1],[Infinity,0]])assert.throws(()=>discountedLineAmounts([{unitPrice:3,quantity:1}],...values))
})
