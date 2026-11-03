import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DEFAULT_REFERRAL_POLICY,validReferralTiers,validReferralPolicy,referralPolicyRate,referralPolicyDescription} from '../../supabase/functions/_shared/referralPolicy.js'
test('confirmed default schedule stops after each buyer order 20',()=>{
 assert.equal(DEFAULT_REFERRAL_POLICY.buyer_discount_bps,500)
 assert.deepEqual([1,2,3,10,11,20,21,200].map(n=>referralPolicyRate(n)),[1000,500,200,200,100,100,0,0])
 for(const n of [0,-1,1.2,NaN,Infinity,'1',null])assert.equal(referralPolicyRate(n),0)
})
test('individual code policies support zero and precise custom rates without changing defaults',()=>{
 const policy={buyer_discount_bps:725,tiers:[{through:3,bps:1234},{through:5,bps:0},{through:7,bps:50}]}
 assert.equal(validReferralPolicy(policy),true)
 assert.deepEqual([1,3,4,5,6,7,8].map(n=>referralPolicyRate(n,policy.tiers)),[1234,1234,0,0,50,50,0])
 assert.equal(referralPolicyRate(1),1000)
 assert.match(referralPolicyDescription(policy),/7.25%/)
 assert.match(referralPolicyDescription(policy),/12.34% on orders 1–3/)
})
test('invalid rates, tier shapes, missing bounds and non-integer inputs fail closed',()=>{
 for(const tiers of [null,{},[],[{through:1,bps:-1}],[{through:1,bps:10001}],[{through:1,bps:1.2}],[{through:0,bps:1}],[{through:1.2,bps:1}],[{through:1,bps:'500'}],[{through:2147483648,bps:1}],[{through:2,bps:1},{through:2,bps:1}],[{through:2,bps:1},{through:1,bps:1}],[{through:1,bps:500,extra:true}],Array.from({length:21},(_,i)=>({through:i+1,bps:1}))]){
  assert.equal(validReferralTiers(tiers),false,JSON.stringify(tiers));assert.equal(referralPolicyRate(1,tiers),0)
 }
 for(const bps of [null,'500',-1,10001,1.2,Infinity])assert.equal(validReferralPolicy({buyer_discount_bps:bps,tiers:DEFAULT_REFERRAL_POLICY.tiers}),false)
 assert.equal(validReferralPolicy({buyer_discount_bps:0,tiers:[{through:1,bps:0}]}),true)
 assert.equal(validReferralPolicy({buyer_discount_bps:10000,tiers:[{through:1,bps:10000}]}),true)
})
