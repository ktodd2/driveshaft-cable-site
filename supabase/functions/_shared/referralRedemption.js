// Reward cents are ledger units. A new check costs two reward cents per cash cent.
export const REDEMPTION_POLICY_VERSION='check-half-value-v1'
export const CHECK_VALUE_BPS=5000
export function rewardsForCheck(cashCents){
 if(!Number.isSafeInteger(cashCents)||cashCents<1||cashCents>1073741823)throw Error('Enter a valid check amount in whole cents.')
 return cashCents*2
}
export function checkValueFromRewards(rewardCents,bps=CHECK_VALUE_BPS){
 if(!Number.isSafeInteger(rewardCents)||![5000,10000].includes(bps))return 0
 return Math.floor(Math.max(0,rewardCents)/(bps===5000?2:1))
}
export function recordedCheckValue(redemption){
 if(redemption.kind!=='check')return 0
 return Number.isSafeInteger(redemption.check_amount_cents)?redemption.check_amount_cents:checkValueFromRewards(redemption.total_cents,redemption.cash_value_bps??10000)
}
export function checkRedemptionAcknowledgement(redemption){
 return redemption.kind==='check'&&redemption.conversion_version===REDEMPTION_POLICY_VERSION?{redemption_version:REDEMPTION_POLICY_VERSION,check_cash_cents:recordedCheckValue(redemption)}:{}
}
