import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {customerStatementText,statementDisplayName,statementText} from '../../supabase/functions/_shared/referrals.js'
import {sendReferralStatement} from '../../supabase/functions/_shared/referralStatements.js'
import {statementDb} from '../fixtures/referralStatementDb.mjs'
import {customerStatementFixture} from '../fixtures/referralCustomerStatement.mjs'
test('customer report separates purchase-period and lifetime totals with each order rate and refund',()=>{
 const statement=customerStatementFixture(),text=statementText({name:statement.recipient_name,code:statement.referral_code},statement)
 assert.match(text,/Purchase period: 2026-11/);assert.match(text,/Lifetime: 3 order\(s\); product purchases \$250.00/)
 assert.match(text,/Purchase period 2026-11: 2 order\(s\); product purchases \$150.00/)
 assert.match(text,/Original commission \$14.50; confirmed refund reductions \$2.00/)
 for(const rate of ['10%','5%','2%'])assert.ok(text.includes(rate))
 assert.match(text,/Order 1 \(2026-10-20, outside purchase period\)/);assert.match(text,/Order 3 \(2026-11-29, in purchase period\): 2%/)
 assert.match(text,/pending \$2.00; vested before payouts\/reservations \$10.50; on hold \$0.00/)
 assert.match(text,/Available: \$11.50/);assert.match(text,/Customer name unavailable/)
 assert.match(text,/Refunds shown are cumulative/);assert.match(text,/overall available balance above deducts/)
})
test('untrusted names stay on one plaintext line, email-like name values are omitted, and no HTML transport is used',async()=>{
 const db=statementDb(0),statement=customerStatementFixture();statement.customer_details.customers[0].name='<img src=x onerror=alert(1)>\r\nAvailable: $999999\u202e bad@invalid.test'
 statement.customer_details.customers[0].email='BUYER_EMAIL_PRIVATE@invalid.test';statement.customer_details.customers[0].address='BUYER_ADDRESS_PRIVATE';statement.customer_details.customers[0].payment='BUYER_PAYMENT_PRIVATE'
 db.tables.referral_statements.push(statement);let body
 await sendReferralStatement(db,statement.id,{enabled:true,apiKey:'fixture-only',transport:async(url,opts)=>{body=JSON.parse(opts.body);return Response.json({id:'provider-fixture'})}})
 assert.equal(body.to,'example-referrer@invalid.test');assert.ok(!Object.hasOwn(body,'html'));assert.ok(body.text.includes('<img src=x onerror=alert(1)>'))
 assert.ok(!body.text.includes('\nAvailable: $999999'));assert.ok(!body.text.includes('\u202e'))
 for(const secret of ['bad@invalid.test','BUYER_EMAIL_PRIVATE','BUYER_ADDRESS_PRIVATE','BUYER_PAYMENT_PRIVATE'])assert.ok(!body.text.includes(secret),secret)
 assert.ok(!JSON.stringify(db.tables.email_attempts).includes('<img'))
 for(const name of ['someone@invalid.test','john@éxample.com','john@localhost'])assert.equal(statementDisplayName(name),'Customer name unavailable')
 assert.equal(statementDisplayName('Jo\u061c\u200e\u200f\u202e\u2066 Name'),'Jo Name')
 assert.equal(statementDisplayName(' \n\t '),'Customer name unavailable')
})
test('legacy missing names/details do not fall back to a buyer email or live order lookup',()=>{
 assert.match(customerStatementText(null),/not captured for this older statement/)
 const details=customerStatementFixture().customer_details;details.customers[0].name=null
 assert.match(customerStatementText(details),/Customer name unavailable/)
 assert.ok(!customerStatementText(details).includes('@'))
})
test('checkout code entry and referrer signup explain named-purchase sharing upfront',()=>{
 const checkout=readFileSync('src/pages/CheckoutPage.jsx','utf8'),signup=readFileSync('src/pages/ReferralSignupPage.jsx','utf8')
 assert.match(checkout,/Using this code lets the referrer see your name, eligible product spending after discounts, and commission details/)
 assert.match(checkout,/This applies to this order and future orders using the same email/);assert.match(checkout,/Your email, address, tax, shipping and payment details are not included/)
 assert.match(signup,/Statements include your referred customers’ names, eligible product spending and commission details/)
})
test('unallocated partial refunds are visibly provisional and excluded from confirmed spend and commission',()=>{
 const statement=customerStatementFixture(),c=statement.customer_details.customers[0]
 for(const totals of [c.period,c.lifetime])Object.assign(totals,{orders:1,product_sales_cents:10000,refunded_product_cents:0,net_product_sales_cents:0,original_commission_cents:1000,refund_reduction_cents:0,commission_cents:0,refund_allocation_pending_orders:1,provisional_net_product_sales_cents:10000,provisional_commission_cents:1000})
 c.rates=[{rate_bps:1000,orders:1,net_product_sales_cents:0,commission_cents:0,refund_allocation_pending_orders:1,provisional_net_product_sales_cents:10000,provisional_commission_cents:1000}]
 c.orders=[{number:1,paid_on:'2026-11-12',in_period:true,rate_bps:1000,product_sales_cents:10000,refunded_product_cents:0,net_product_sales_cents:10000,original_commission_cents:1000,refund_reduction_cents:0,commission_cents:1000,refund_allocation_pending:true,timing:'held'}]
 c.timing={pending_cents:0,vested_cents:0,held_cents:1000}
 const text=customerStatementText(statement.customer_details)
 assert.match(text,/confirmed net product spend \$0.00; calculated commission \$0.00/)
 assert.match(text,/excluded from confirmed net totals/);assert.match(text,/potential commission \$10.00 are not final or available/)
 assert.match(text,/final eligible spend and commission await product-refund allocation/);assert.match(text,/held, not final or available/)
})
