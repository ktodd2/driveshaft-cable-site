// Service-only adapter. Currency is always integer USD cents. No secrets or bodies in logs.
import {checkValueFromRewards} from './referralRedemption.js'
import {referralPolicyRate} from './referralPolicy.js'
export const normalizeReferralEmail = value => String(value ?? '').trim().toLowerCase()
export const referralRate = (n,tiers) => referralPolicyRate(n,tiers)
export const referralCommission = (base, refunded, bps) => Math.round((base - refunded) * bps / 10000)
export const referralMonth = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit' }).format(date)
export async function rpc(db, name, args) {
 const {data,error} = await db.rpc(name,args)
 if(error) throw Error(error.message || 'Referral storage unavailable')
 return data
}
export async function prepareReferralCheckout(db, stripe, input, now = Date.now()) {
 const named=Object.prototype.hasOwnProperty.call(input,'p_buyer_name')
 const snapshot = await rpc(db,named?'referral_prepare_named':'referral_prepare',input)
 if(!snapshot.intent_id && now-new Date(snapshot.created_at).getTime()>=23*3600000) throw Error('This checkout needs owner review; start a new checkout rather than retrying an uncertain payment.')
 const intent=snapshot.intent_id ? await stripe.paymentIntents.retrieve(snapshot.intent_id) :
  await stripe.paymentIntents.create(snapshot.intent_params,{idempotencyKey:`referral-checkout/${snapshot.order_id}`})
 if(intent.status==='canceled') throw Error('This checkout was canceled. Please start a new checkout.')
 await rpc(db,'referral_attach',{p_order:snapshot.order_id,p_intent:intent.id})
 return intent
}
async function observePaidIntent(db,stripe,intent,eventVersion,successTimestamp=null) {
 if(!intent.livemode || intent.status!=='succeeded' || intent.currency!=='usd' || intent.metadata?.referral_system!=='v1') return false
 const charge=typeof intent.latest_charge==='object' ? intent.latest_charge : await stripe.charges.retrieve(intent.latest_charge)
 if(!charge?.paid || !charge.created || intent.amount_received!==intent.amount) throw Error('Payment needs authoritative charge review')
 await rpc(db,'referral_paid',{p_order:intent.metadata.order_id,p_intent:intent.id,p_email:normalizeReferralEmail(intent.receipt_email),p_amount:intent.amount,p_paid:new Date(successTimestamp ? successTimestamp*1000 : Date.now()).toISOString(),p_verified:!!successTimestamp})
 let disputed=false
 if(charge.disputed) {
  const disputes=await stripe.disputes.list({charge:charge.id,limit:10})
  if(disputes.has_more) throw Error('Dispute history requires review')
  disputed=disputes.data.some(d=>d.status!=='won' && d.status!=='warning_closed')
 }
 await rpc(db,'referral_adjust',{p_intent:intent.id,p_refunded:charge.amount_refunded||0,p_disputed:disputed,p_version:eventVersion})
 return true
}
export async function syncReferralIntent(db,stripe,intentId,eventVersion,successTimestamp=null) {
 const intent=await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']})
 if(!await observePaidIntent(db,stripe,intent,eventVersion,successTimestamp)) return
 const email=normalizeReferralEmail(intent.receipt_email)
 const {data:open,error}=await db.from('referral_checkouts').select('order_id,intent_id,state,paid_time_verified').eq('email',email).in('state',['prepared','observed']).limit(101)
 if(error || !Array.isArray(open)) throw Error('Referral reconciliation unavailable')
 // Bounded external reads. A large or uncertain set holds rewards for owner review, never the buyer's payment.
 if(open.length>100) return
 for(const other of open) {
  if(other.order_id===intent.metadata.order_id || other.state==='observed' && other.paid_time_verified || !other.intent_id) continue
  const candidate=await stripe.paymentIntents.retrieve(other.intent_id,{expand:['latest_charge']})
  if(candidate.status==='succeeded') await observePaidIntent(db,stripe,candidate,eventVersion)
  else await rpc(db,'referral_unpaid',{p_order:other.order_id,p_cancelled:candidate.status==='canceled'})
 }
 await rpc(db,'referral_reconcile',{p_email:email})
}
export async function handleReferralEvent(db,stripe,event) {
 if(!event.livemode) return
 const object=event.data.object
 let id=null
 if(event.type.startsWith('payment_intent.')) id=object.id
 else if(event.type==='charge.refunded' || event.type.startsWith('charge.dispute.')) id=object.payment_intent
 else if(event.type.startsWith('refund.') || event.type==='charge.refund.updated') {
  const charge=await stripe.charges.retrieve(typeof object.charge==='string'?object.charge:object.charge.id)
  id=charge.payment_intent
 }
 if(typeof id==='object') id=id?.id
 if(typeof id==='string') await syncReferralIntent(db,stripe,id,event.created,event.type==='payment_intent.succeeded'?event.created:null)
}
export function statementDisplayName(value) {
 const clean=String(value||'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\p{Bidi_Control}/gu,' ').replace(/\S*@\S*/gu,'[email omitted]').replace(/\s+/g,' ').trim()
 return !clean.replace(/\[email omitted\]/g,'').trim()?'Customer name unavailable':Array.from(clean).slice(0,160).join('')
}
export function customerStatementText(details) {
 if(!details?.customers)return '\nCustomer details were not captured for this older statement.'
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0)/100)
 const provisional=t=>t.refund_allocation_pending_orders>0?` ${t.refund_allocation_pending_orders} order(s) await product-refund allocation: excluded from confirmed net totals; provisional maximum product spend ${money(t.provisional_net_product_sales_cents)} and potential commission ${money(t.provisional_commission_cents)} are not final or available.`:''
 const totals=(label,t)=>`${label}: ${t.orders} order(s); product purchases ${money(t.product_sales_cents)} after discounts; confirmed product refunded ${money(t.refunded_product_cents)}; confirmed net product spend ${money(t.net_product_sales_cents)}; calculated commission ${money(t.commission_cents)}. Original commission ${money(t.original_commission_cents)}; confirmed refund reductions ${money(t.refund_reduction_cents)}.${provisional(t)}`
 const lines=[`\nREFERRED CUSTOMER DETAILS`, `Purchase period: ${details.period_month} (America/Chicago calendar month). Period totals are for orders paid in that month. Refunds shown are cumulative through preparation, including reductions on earlier orders. Lifetime totals include all attributed orders through preparation.`, 'Customer vested commissions are before account-level payouts and reservations; your overall available balance above deducts those amounts. Rates vary by order, as shown below.']
 if(!details.customers.length)lines.push('No attributed paid customer orders in this statement yet.')
 for(const [index,c] of details.customers.entries()) {
  lines.push(`\nCustomer ${index+1}: ${statementDisplayName(c.name)}`,totals(`Purchase period ${details.period_month}`,c.period),totals('Lifetime',c.lifetime),
   `Commission timing: pending ${money(c.timing.pending_cents)}; vested before payouts/reservations ${money(c.timing.vested_cents)}; on hold ${money(c.timing.held_cents)} (subject to review).`,
   'Lifetime rate summary:')
  for(const r of c.rates)lines.push(`  ${r.rate_bps/100}%: ${r.orders} order(s), confirmed net products ${money(r.net_product_sales_cents)}, confirmed commission ${money(r.commission_cents)}.${provisional(r)}`)
  lines.push('Order breakdown: purchase-period orders plus other orders with refunds, pending commissions or holds.')
  if(!c.orders.length)lines.push('  No purchase-period orders or outstanding adjustments; see lifetime rate summary.')
  for(const o of c.orders) {
   const prefix=`  Order ${o.number} (${o.paid_on}${o.in_period?', in purchase period':', outside purchase period'}): ${o.rate_bps/100}%; products ${money(o.product_sales_cents)}, confirmed product refunded ${money(o.refunded_product_cents)};`
   lines.push(o.refund_allocation_pending?`${prefix} final eligible spend and commission await product-refund allocation. Provisional maximum net products ${money(o.net_product_sales_cents)}, potential commission ${money(o.commission_cents)}; held, not final or available.`:
    `${prefix} net products ${money(o.net_product_sales_cents)}; commission ${money(o.commission_cents)} (original ${money(o.original_commission_cents)} less ${money(o.refund_reduction_cents)} confirmed refund reductions); ${o.timing==='vested'?'vested before payouts/reservations':o.timing}${o.dispute_hold?' (dispute review; not available)':''}.`)
  }
 }
 return lines.join('\n')
}
export function statementText(partner,statement) {
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100)
 const b=statement.balance,checkBps=statement.cash_value_bps??10000
 return `Hello ${statementDisplayName(partner.name)},\n\nYour referral code is ${partner.code}. Your ${statement.month} referral reward statement. Balance prepared ${new Date(statement.created_at).toISOString()} (UTC):\nAvailable rewards: ${money(b.available)}\nCheck cash value of available rewards: ${money(checkValueFromRewards(Number(b.available),checkBps))} (${checkBps/100}% conversion)\nProduct credit available: ${money(Math.max(0,Number(b.available)||0))}, including product-redemption shipping\nPending (seven-day wait): ${money(b.pending)}\nOn review hold: ${money(b.held)}\nReserved rewards: ${money(b.reserved)}\nRewards already redeemed: ${money(b.paid)}\nRefund reductions: ${money(b.reversed)}\n\nReply to choose a check or products. For products, tell us what you want. Checks pay ${money(checkBps/100)} per $1 in rewards. For example, $100 in rewards gives ${money(checkBps)} by check or $100 toward products; product shipping also comes from that reward balance. Checks use whole cash cents; any odd unused reward penny stays in rewards. Products use the full reward value at retail prices. Every redemption needs owner approval and sufficient available balance. No payment has been issued by this email. Some orders may await payment or refund verification. Negative balances reduce future earnings.\n\nCommission rates and order limits are configured per code; your actual earned rates appear in the customer/order breakdown below. Changes affect newly prepared future orders, including existing referred buyers. Already prepared checkouts and earned commissions retain their recorded terms. Product revenue after discounts only; tax and shipping do not earn rewards. Fully refunded orders retain their original tier position.\n${customerStatementText(statement.customer_details)}\n\nDriveshaft Cable by K.Todd`
}

export function validateReferralRecovery(snapshot, input, tokenHash) {
 const metadata=snapshot.intent_params?.metadata
 return snapshot.state==='prepared' && snapshot.total_cents===input.amount &&
  metadata?.referral_checkout_hash===tokenHash && metadata?.referral_order_hash===input.orderHash &&
  metadata?.referral_code===String(input.code||'').trim().toUpperCase()
}
