// Service-only adapter. Currency is always integer USD cents. No secrets or bodies in logs.
export const normalizeReferralEmail = value => String(value ?? '').trim().toLowerCase()
export const referralRate = n => n === 1 ? 1000 : n === 2 ? 500 : n <= 10 ? 200 : 100
export const referralCommission = (base, refunded, bps) => Math.round((base - refunded) * bps / 10000)
export const referralMonth = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit' }).format(date)
export async function rpc(db, name, args) {
 const {data,error} = await db.rpc(name,args)
 if(error) throw Error(error.message || 'Referral storage unavailable')
 return data
}
export async function prepareReferralCheckout(db, stripe, input, now = Date.now()) {
 const snapshot = await rpc(db,'referral_prepare',input)
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
export function statementText(partner,statement) {
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100)
 const b=statement.balance
 return `Hello ${partner.name},\n\nYour referral code is ${partner.code}. Your ${statement.month} referral reward statement:\nAvailable: ${money(b.available)}\nPending (seven-day wait): ${money(b.pending)}\nOn review hold: ${money(b.held)}\nReserved: ${money(b.reserved)}\nAlready issued: ${money(b.paid)}\nRefund reductions: ${money(b.reversed)}\n\nReply to choose a check or products. For products, tell us what you want. $1 in rewards covers $1 of merchandise at retail prices; shipping also comes from rewards. Every redemption needs owner approval and sufficient available balance. No payment has been issued by this email. Some orders may await payment or refund verification. Negative balances reduce future earnings.\n\nRewards are 10% on each referred buyer's first paid website retail order, 5% on their second, 2% on orders 3–10 and 1% thereafter. Product revenue after discounts only; tax and shipping do not earn rewards. Fully refunded orders retain their original tier position.\n\nDriveshaft Cable by K.Todd`
}

export function validateReferralRecovery(snapshot, input, tokenHash) {
 const metadata=snapshot.intent_params?.metadata
 return snapshot.state==='prepared' && snapshot.total_cents===input.amount &&
  metadata?.referral_checkout_hash===tokenHash && metadata?.referral_order_hash===input.orderHash &&
  metadata?.referral_code===String(input.code||'').trim().toUpperCase()
}
