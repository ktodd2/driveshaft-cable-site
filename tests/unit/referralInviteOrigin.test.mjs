import {test} from 'node:test'
import {verifyRetiredEndpoint} from '../fixtures/retiredReferralEndpoint.mjs'
test('referral-signup is retired and cannot write, invite or send even with enabling request flags',()=>verifyRetiredEndpoint('referral-signup'))
