// Percentages use integer basis points. No policy edit changes a stored earning.
export const DEFAULT_REFERRAL_POLICY = Object.freeze({buyer_discount_bps:500,tiers:Object.freeze([
 {through:1,bps:1000},{through:2,bps:500},{through:10,bps:200},{through:20,bps:100}
].map(Object.freeze))})
export function validReferralTiers(tiers) {
 return Array.isArray(tiers)&&tiers.length>0&&tiers.length<=20&&tiers.every((tier,index)=>
  tier&&Object.keys(tier).length===2&&Object.hasOwn(tier,'through')&&Object.hasOwn(tier,'bps')&&
  Number.isSafeInteger(tier.through)&&tier.through>0&&tier.through<=2147483647&&
  Number.isSafeInteger(tier.bps)&&tier.bps>=0&&tier.bps<=10000&&(!index||tier.through>tiers[index-1].through))
}
export function validReferralPolicy(policy) {
 return !!policy&&Number.isSafeInteger(policy.buyer_discount_bps)&&policy.buyer_discount_bps>=0&&policy.buyer_discount_bps<=10000&&validReferralTiers(policy.tiers)
}
export function referralPolicyRate(sequence,tiers=DEFAULT_REFERRAL_POLICY.tiers) {
 if(!Number.isSafeInteger(sequence)||sequence<1||!validReferralTiers(tiers))return 0
 return tiers.find(tier=>sequence<=tier.through)?.bps??0
}
export function referralPolicyDescription(policy=DEFAULT_REFERRAL_POLICY) {
 if(!validReferralPolicy(policy))return 'Reward terms unavailable; contact the owner.'
 let from=1
 return policy.tiers.map(tier=>{const range=from===tier.through?`order ${from}`:`orders ${from}–${tier.through}`;from=tier.through+1;return `${tier.bps/100}% on ${range}`}).join(', ')+`, then 0%. First eligible order discount: ${policy.buyer_discount_bps/100}%.`
}
