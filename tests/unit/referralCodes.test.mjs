import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeReferralCode,referralCodeProblem,generateReferralCode} from '../../src/lib/referralCodes.js'
test('custom referral codes trim and normalize case with bounded safe feedback',()=>{
 assert.equal(normalizeReferralCode(' ktodd-shop '),'KTODD-SHOP');assert.equal(referralCodeProblem(' ktodd-shop '),null)
 for(const code of ['', 'ab','-ABC','ABC-','ABC DEF','<script>','A'.repeat(25)])assert.match(referralCodeProblem(code),/3–24/)
 assert.equal(referralCodeProblem('A'.repeat(24)),null)
})
test('generated referral codes avoid confusing characters and remain public codes rather than invitation tokens',()=>{
 const seen=new Set()
 for(let i=0;i<100;i++){const code=generateReferralCode();assert.match(code,/^DC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);assert.equal(referralCodeProblem(code),null);seen.add(code)}
 assert.ok(seen.size>1)
 const fixed={getRandomValues(bytes){bytes.fill(255);return bytes}}
 assert.equal(generateReferralCode(fixed),'DC-99999999')
})
