import {test} from 'node:test'
import assert from 'node:assert/strict'
import {rewardsForCheck,checkValueFromRewards,recordedCheckValue,checkRedemptionAcknowledgement,REDEMPTION_POLICY_VERSION} from '../../supabase/functions/_shared/referralRedemption.js'
import {statementText} from '../../supabase/functions/_shared/referrals.js'
import {referralAnnouncementTemplate as template} from '../../src/lib/referralAnnouncementTemplate.js'
test('cash uses twice the reward cents; odd reward penny is retained and invalid amounts fail',()=>{
 assert.equal(REDEMPTION_POLICY_VERSION,'check-half-value-v1')
 assert.equal(rewardsForCheck(5000),10000);assert.equal(checkValueFromRewards(10000),5000)
 assert.equal(checkValueFromRewards(10001),5000);assert.equal(10001-rewardsForCheck(checkValueFromRewards(10001)),1)
 for(const value of [0,-1,0.5,'5000',NaN,Infinity,1073741824])assert.throws(()=>rewardsForCheck(value))
 assert.equal(checkValueFromRewards(-100),0);assert.equal(checkValueFromRewards(1.5),0)
 assert.equal(checkValueFromRewards(Number.MAX_SAFE_INTEGER,10000),Number.MAX_SAFE_INTEGER)
 assert.equal(checkValueFromRewards(Number.MAX_SAFE_INTEGER,5000),4503599627370495)
 assert.equal(recordedCheckValue({kind:'check',total_cents:10000,cash_value_bps:5000,check_amount_cents:5000}),5000)
 assert.equal(recordedCheckValue({kind:'check',total_cents:10000}),10000,'legacy requests keep full cash value')
 assert.equal(recordedCheckValue({kind:'product',total_cents:10000}),0)
 assert.deepEqual(checkRedemptionAcknowledgement({kind:'check',total_cents:10000,check_amount_cents:5000,conversion_version:REDEMPTION_POLICY_VERSION}),{redemption_version:REDEMPTION_POLICY_VERSION,check_cash_cents:5000})
 assert.deepEqual(checkRedemptionAcknowledgement({kind:'check',total_cents:10000,conversion_version:'legacy-full-value-v1'}),{})
})
test('frozen statement terms distinguish reward balance, cash value and product credit',()=>{
 const s={month:'2026-12',created_at:'2026-12-01T06:00:00Z',balance:{available:10001,pending:0,held:0,reserved:0,paid:0,reversed:0}}
 const text=statementText({name:'Fixture',code:'FIXTURE'},{...s,cash_value_bps:5000})
 assert.match(text,/Available rewards: \$100.01/);assert.match(text,/Check cash value of available rewards: \$50.00/)
 assert.match(text,/Product credit available: \$100.01/);assert.match(text,/\$100 in rewards gives \$50.00 by check/)
 assert.match(text,/product shipping also comes from that reward balance/)
 assert.match(statementText({name:'Fixture',code:'FIXTURE'},s),/\$100 in rewards gives \$100.00 by check/)
})
test('approved reusable announcement includes tiers and explicit half-value checks, without automatic recipients or schedule',()=>{
 assert.equal(template.subject,'Earn rewards with Driveshaft Cable referrals')
 for(const copy of ['5% off their first order','10% on their first order','5% on their second order','2% on orders 3–10','1% on orders 11–20','after discounts, excluding shipping and tax','$100 in rewards gives a $50 check or $100 toward products','same reward balance','Every redemption requires approval'])assert.ok(template.html.includes(copy),copy)
 assert.deepEqual(Object.keys(template).sort(),['description','html','label','subject'])
})
