import {prepareSecureReferral,attachSecureReferral} from './secureReferrals.js'
import {trustedFinancialSnapshot} from './purchaseAnalytics.js'
import {getShippingAddressProblem,SHIPPING_ADDRESS_MESSAGES} from './checkoutShipping.js'
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const normalizeEmail=value=>String(value??'').trim().toLowerCase()
const field=(value,max,required=false)=>{if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||required&&!value.trim())throw Error('Invalid checkout details');return value.trim()}
export function normalizeCheckoutInput(input,{complete=true}={}){
 if(!input||typeof input!=='object'||!Array.isArray(input.items)||!input.items.length||input.items.length>50)throw Error('A valid cart is required')
 const quantities=new Map()
 for(const item of input.items){if(typeof item?.productId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.productId)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>100000)throw Error('Invalid cart item');quantities.set(item.productId,(quantities.get(item.productId)||0)+item.quantity)}
 const items=[...quantities].sort(([a],[b])=>a.localeCompare(b)).map(([productId,quantity])=>{if(quantity>100000)throw Error('Invalid cart quantity');return {productId,quantity}})
 const source=input.customer||{},email=normalizeEmail(field(source.email,254,complete))
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('A valid email is required')
 const address={address1:field(source.address1,200,complete),address2:field(source.address2,200),city:field(source.city,100,complete),state:field(source.state,60,complete),zip:field(source.zip,12,complete),country:field(source.country||'US',2)}
 if(address.country!=='US')throw Error('We only ship to US addresses from this checkout')
 if(complete){const problem=getShippingAddressProblem(address);if(problem)throw Error(SHIPPING_ADDRESS_MESSAGES[problem])}
 const customer={email,name:field(source.name,160,complete),company:field(source.company,200),phone:field(source.phone,50),...address}
 const referralCode=field(input.referralCode,24).toUpperCase()
 return {customer,items,discountCode:field(input.discountCode,40).toUpperCase(),howHeard:field(input.howHeard,300),...(referralCode?{referralCode}:{})}
}
export function checkoutIdentity(input){
 if(typeof input.checkoutId!=='string'||!ID.test(input.checkoutId)||typeof input.checkoutToken!=='string'||!/^[a-f0-9]{64}$/.test(input.checkoutToken)||!Number.isSafeInteger(input.amount)||input.amount<1)throw Error('Checkout session is unavailable. Refresh and try again.')
 return {id:input.checkoutId,token:input.checkoutToken,amount:input.amount}
}
export async function checkoutDigest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export function checkoutErrorMessage(error){
 const text=String(error?.message||'')
 return /^(Email verification required\b|This discount makes the order total zero\.|An unfinished first-order checkout is open for this email\.|An earlier payment needs verification before another first order\.|Code settings changed\.|Customer pricing changed\.|Checkout has been updated\.|This checkout was cancel)/.test(text)?text:'Checkout could not be prepared. Retry this checkout or contact the owner before paying again.'
}
export async function checkedRpc(db,name,args){const {data,error}=await db.rpc(name,args);if(error){const safe=checkoutErrorMessage(error);throw Error(safe.startsWith('Checkout could not')?'Checkout storage unavailable':safe)}return data}
export function intentMatchesCheckout(intent,snapshot){
 return intent?.id && intent.livemode===true && intent.currency==='usd' && intent.amount===snapshot.intent_params.amount && normalizeEmail(intent.receipt_email)===normalizeEmail(snapshot.order_snapshot.email)
 && intent.metadata?.order_id===snapshot.order_id && intent.metadata?.secure_checkout_id===snapshot.id && (!snapshot.intent_id||snapshot.intent_id===intent.id)
}
const noAnalytics=(_value)=>({})
/** @returns {string|null} */
const noSnapshot=(_value)=>null
export async function createSecurePayment(db,stripe,input,price,{now=Date.now,analyticsMetadata=noAnalytics,purchaseSnapshot=noSnapshot,referralEnabled=false}={}){
 const identity=checkoutIdentity(input),normalized=normalizeCheckoutInput(input),capabilityHash=await checkoutDigest(identity.token),fingerprint=await checkoutDigest(JSON.stringify([normalized,identity.amount]))
 const {data:existing,error}=await db.from('checkout_requests').select('*').eq('id',identity.id).maybeSingle()
 if(error)throw Error('Checkout verification unavailable')
 let snapshot=existing
 if(snapshot){if(snapshot.capability_hash!==capabilityHash||snapshot.fingerprint!==fingerprint)throw Error('Checkout capability or details changed')}
 else{
  if(normalized.referralCode&&!referralEnabled)return {status:409,body:{error:'Referral codes are not available yet.'}}
  const priced=await price(normalized)
  const buyerProofHash=typeof input.buyerVerificationToken==='string'&&/^[a-f0-9]{64}$/.test(input.buyerVerificationToken)?await checkoutDigest(input.buyerVerificationToken):null
  if(priced.totalCents!==identity.amount)return {status:409,body:{error:'Your order total has changed. Please review the updated total and try again.',expectedAmount:priced.totalCents}}
  const order={email:normalized.customer.email,name:normalized.customer.name,company:normalized.customer.company||null,phone:normalized.customer.phone||null,
   shipping_address:Object.fromEntries(['address1','address2','city','state','zip','country'].map(key=>[key,normalized.customer[key]])),
   items:priced.lines.map(line=>({productId:line.productId,name:line.name,quantity:line.quantity,price:line.unitPrice})),
   subtotal_cents:priced.subtotalCents,discount_cents:priced.discountCents,discount_source:priced.discountSource,discount_reason:priced.referralDiscountCents?`Referral discount ${priced.referralDiscountBps/100}%${priced.baseDiscountSource==='combined'?` plus loyalty discount and discount code ${priced.discountCode}`:priced.baseDiscountSource==='code'?` plus discount code ${priced.discountCode}`:priced.baseDiscountSource==='loyalty'?' plus loyalty discount':''}`:priced.discountSource==='combined'?`Loyalty discount plus discount code ${priced.discountCode}`:priced.discountSource==='loyalty'?'Returning customer 10% loyalty discount':priced.discountSource==='code'?`Discount code ${priced.discountCode}`:null,
   discount_code:['code','combined'].includes(priced.baseDiscountSource||priced.discountSource)?priced.discountCode:null,shipping_cents:priced.shippingCents,tax_cents:priced.taxCents,stripe_tax_calculation_id:priced.taxCalculationId,total_cents:priced.totalCents,how_heard:normalized.howHeard||null,
   ...(referralEnabled?{referral_policy:priced.referralPolicy||null,referral_discount_cents:priced.referralDiscountCents||0,pricing_repeat:priced.repeat===true,buyer_verification_hash:buyerProofHash}: {})}
  const purchase=purchaseSnapshot(priced)
  const itemMetadata=JSON.stringify(normalized.items)
  const params={amount:priced.totalCents,currency:'usd',receipt_email:order.email,metadata:{order_id:'pending',secure_checkout_id:identity.id,...(referralEnabled?{referral_system:'v1',referral_code:normalized.referralCode||'',referral_pricing_version:'v2'}:{}),...(itemMetadata.length<=500?{items:itemMetadata}:{}),tax_calculation_id:priced.taxCalculationId||'',...(purchase?{ga4_purchase:purchase,...analyticsMetadata(input.analytics)}:{})}}
  snapshot=await checkedRpc(db,'prepare_secure_checkout',{p_id:identity.id,p_capability_hash:capabilityHash,p_fingerprint:fingerprint,p_order:order,p_params:params})
 }
 const intent=await recoverSecureIntent(db,stripe,snapshot,now)
 return {status:200,body:{orderId:snapshot.order_id,clientSecret:intent.client_secret,status:intent.status,checkout:privateCheckoutView(snapshot)}}
}
function privateCheckoutView(snapshot){
 const order=snapshot.order_snapshot
 return {customer:{email:order.email,name:order.name,company:order.company||'',phone:order.phone||'',...order.shipping_address},items:order.items,
 referralCode:snapshot.intent_params.metadata?.referral_code||'',discountCode:order.discount_code||null,
 pricing:{subtotalCents:order.subtotal_cents,discountCents:order.discount_cents,shippingCents:order.shipping_cents,taxCents:order.tax_cents,totalCents:order.total_cents,
 discountSource:order.discount_source||(order.referral_discount_cents?'referral':order.discount_code?'code':order.discount_cents?'loyalty':null),taxQuoted:!!order.stripe_tax_calculation_id}}
}
async function recoverSecureIntent(db,stripe,snapshot,now){
 if(snapshot.cancelled_at)throw Error('This checkout was cancelled. Start a new checkout.')
 if(snapshot.first_order_coordinated!==undefined){
  try{await checkedRpc(db,'assert_checkout_open',{p_id:snapshot.id,p_capability_hash:snapshot.capability_hash})}
  catch(error){
   if(snapshot.intent_id&&String(error.message).startsWith('This checkout was cancelled or cancellation is pending.')){
    const current=await stripe.paymentIntents.retrieve(snapshot.intent_id)
    if(intentMatchesCheckout(current,snapshot)&&['succeeded','processing'].includes(current.status))return current
    throw Error('This checkout was cancelled or cancellation is pending. Retry cancellation or contact us before paying again.')
   }
   throw error
  }
 }
 const referral=await prepareSecureReferral(db,snapshot)
 const knownIntent=snapshot.intent_id||referral?.intent_id
 if(!knownIntent && now()-new Date(snapshot.created_at).getTime()>=23*3600000)throw Error('This payment requires owner verification before retrying. Do not pay again until it is checked.')
 const intent=knownIntent?await stripe.paymentIntents.retrieve(knownIntent):await stripe.paymentIntents.create(snapshot.intent_params,{idempotencyKey:`secure-checkout/${snapshot.id}`})
 if(!intentMatchesCheckout(intent,snapshot))throw Error('Payment binding requires review')
 if(intent.status==='canceled')throw Error('This checkout was canceled. Start a new checkout.')
 await checkedRpc(db,'attach_secure_checkout',{p_id:snapshot.id,p_intent:intent.id})
 await attachSecureReferral(db,snapshot,intent)
 return intent
}
export async function resumeSecurePayment(db,stripe,input,{now=Date.now}={}){
 if(typeof input?.checkoutId!=='string'||!ID.test(input.checkoutId)||typeof input.checkoutToken!=='string'||!/^[a-f0-9]{64}$/.test(input.checkoutToken))throw Error('Checkout unavailable')
 const {data:snapshot,error}=await db.from('checkout_requests').select('*').eq('id',input.checkoutId).maybeSingle()
 if(error||!snapshot||snapshot.capability_hash!==await checkoutDigest(input.checkoutToken))throw Error('Checkout unavailable')
 const intent=await recoverSecureIntent(db,stripe,snapshot,now)
 return {status:200,body:{orderId:snapshot.order_id,clientSecret:intent.client_secret,status:intent.status,checkout:privateCheckoutView(snapshot)}}
}

export async function reconcileOrderPayment(db,stripe,intent,{failed=false}={}){
 if(intent?.livemode!==true)throw Error('Payment mode requires review')
 if(!intent?.metadata?.order_id||intent.currency!=='usd')throw Error('Payment binding requires review')
 if(intent.status!=='succeeded'&&!failed)return {status:'pending'}
 if(intent.status==='succeeded'&&(intent.amount_received!==intent.amount||!intent.latest_charge||typeof intent.latest_charge!=='object'||!intent.latest_charge.paid))throw Error('Payment charge is not verified')
 const result=await checkedRpc(db,'apply_verified_order_payment',{p_order:intent.metadata.order_id,p_intent:intent.id,p_amount:intent.amount,p_currency:intent.currency,p_email:normalizeEmail(intent.receipt_email),p_checkout:intent.metadata.secure_checkout_id||null,p_succeeded:intent.status==='succeeded',p_items:JSON.parse(intent.metadata.items||'null'),p_tax_calculation:intent.metadata.tax_calculation_id||null,p_financial:trustedFinancialSnapshot(intent)})
 if(intent.status!=='succeeded')return result
 const tax=await checkedRpc(db,'claim_order_tax',{p_order:intent.metadata.order_id})
 if(tax){
  let transaction
  try{transaction=await stripe.tax.transactions.createFromCalculation({calculation:tax.calculation_id,reference:tax.reference},{idempotencyKey:`order-tax/${tax.reference}`})}
  catch{await checkedRpc(db,'record_order_tax',{p_order:intent.metadata.order_id,p_transaction:null});return {...result,taxReview:true}}
  // A storage failure after provider acceptance leaves a processing receipt. Never blindly send again.
  await checkedRpc(db,'record_order_tax',{p_order:intent.metadata.order_id,p_transaction:transaction.id})
 }
 return result
}
// Called only by an explicit buyer request carrying the original private capability.
// Never expires a reservation, cancels a processing payment or changes a paid order.
export async function cancelSecurePayment(db,stripe,input,{now=Date.now,actorId=null}={}){
 if(typeof input?.checkoutId!=='string'||!ID.test(input.checkoutId)||(!actorId&&(typeof input.checkoutToken!=='string'||!/^[a-f0-9]{64}$/.test(input.checkoutToken))))throw Error('Checkout cancellation unavailable')
 const snapshot=actorId?await checkedRpc(db,'referral_admin_cancel_request',{p_actor:actorId,p_checkout:input.checkoutId}):await checkedRpc(db,'request_checkout_cancellation',{p_id:input.checkoutId,p_capability_hash:await checkoutDigest(input.checkoutToken)})
 if(!snapshot)return {status:200,body:{status:'cancelled'}} // Durable tombstone prevents any in-flight or later preparation of this ID.
 const hash=snapshot.capability_hash
 if(snapshot.cancelled_at)return {status:200,body:{status:'cancelled'}}
 if(!snapshot.intent_id&&now()-new Date(snapshot.created_at).getTime()>=23*3600000)return {status:409,body:{error:'This older payment has an uncertain provider reference. Owner verification is required; no new intent was created or reservation released.'}}
 const intent=snapshot.intent_id?await stripe.paymentIntents.retrieve(snapshot.intent_id,{expand:['latest_charge']}):await stripe.paymentIntents.create(snapshot.intent_params,{idempotencyKey:`secure-checkout/${snapshot.id}`})
 if(!intentMatchesCheckout(intent,snapshot))throw Error('Checkout cancellation unavailable')
 if(intent.status==='succeeded'){
  await checkedRpc(db,'attach_secure_checkout',{p_id:snapshot.id,p_intent:intent.id})
  await reconcileOrderPayment(db,stripe,intent)
  return {status:409,body:{status:'paid',orderId:snapshot.order_id,...(!actorId?{clientSecret:intent.client_secret}:{}),error:'This order is already paid. Continue to its confirmation; do not pay again.'}}
 }
 if(!['canceled','requires_payment_method','requires_confirmation','requires_action'].includes(intent.status))return {status:409,body:{error:'Payment is processing. Wait for confirmation before starting another checkout.'}}
 let cancelled=intent
 if(intent.status!=='canceled'){
  try{cancelled=await stripe.paymentIntents.cancel(intent.id,{}, {idempotencyKey:`buyer-cancel/${snapshot.id}`})}
  catch{return {status:409,body:{error:'Payment status changed or cancellation is uncertain. Resume this checkout or contact us before starting another.'}}}
 }
 if(!intentMatchesCheckout(cancelled,snapshot)||cancelled.status!=='canceled')throw Error('Checkout cancellation needs provider verification')
 await checkedRpc(db,'cancel_secure_checkout',{p_id:snapshot.id,p_capability_hash:hash,p_intent:intent.id})
 return {status:200,body:{status:'cancelled'}}
}
