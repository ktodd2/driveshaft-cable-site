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
export async function checkedRpc(db,name,args){const {data,error}=await db.rpc(name,args);if(error)throw Error('Checkout storage unavailable');return data}
export function intentMatchesCheckout(intent,snapshot){
 return intent?.id && intent.currency==='usd' && intent.amount===snapshot.intent_params.amount && normalizeEmail(intent.receipt_email)===normalizeEmail(snapshot.order_snapshot.email)
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
  if(priced.totalCents!==identity.amount)return {status:409,body:{error:'Your order total has changed. Please review the updated total and try again.',expectedAmount:priced.totalCents}}
  const order={email:normalized.customer.email,name:normalized.customer.name,company:normalized.customer.company||null,phone:normalized.customer.phone||null,
   shipping_address:Object.fromEntries(['address1','address2','city','state','zip','country'].map(key=>[key,normalized.customer[key]])),
   items:priced.lines.map(line=>({productId:line.productId,name:line.name,quantity:line.quantity,price:line.unitPrice})),
   subtotal_cents:priced.subtotalCents,discount_cents:priced.discountCents,discount_reason:priced.discountSource==='loyalty'?'Returning customer 10% loyalty discount':priced.discountSource==='code'?`Discount code ${priced.discountCode}`:null,
   discount_code:priced.discountSource==='code'?priced.discountCode:null,shipping_cents:priced.shippingCents,tax_cents:priced.taxCents,stripe_tax_calculation_id:priced.taxCalculationId,total_cents:priced.totalCents,how_heard:normalized.howHeard||null}
  const purchase=purchaseSnapshot(priced)
  const itemMetadata=JSON.stringify(normalized.items)
  const params={amount:priced.totalCents,currency:'usd',receipt_email:order.email,metadata:{order_id:'pending',secure_checkout_id:identity.id,...(referralEnabled?{referral_system:'v1',referral_code:normalized.referralCode||''}:{}),...(itemMetadata.length<=500?{items:itemMetadata}:{}),tax_calculation_id:priced.taxCalculationId||'',...(purchase?{ga4_purchase:purchase,...analyticsMetadata(input.analytics)}:{})}}
  snapshot=await checkedRpc(db,'prepare_secure_checkout',{p_id:identity.id,p_capability_hash:capabilityHash,p_fingerprint:fingerprint,p_order:order,p_params:params})
 }
 const referral=await prepareSecureReferral(db,snapshot)
 const knownIntent=snapshot.intent_id||referral?.intent_id
 if(!knownIntent && now()-new Date(snapshot.created_at).getTime()>=23*3600000)throw Error('This payment requires owner verification before retrying. Do not pay again until it is checked.')
 const intent=knownIntent?await stripe.paymentIntents.retrieve(knownIntent):await stripe.paymentIntents.create(snapshot.intent_params,{idempotencyKey:`secure-checkout/${identity.id}`})
 if(!intentMatchesCheckout(intent,snapshot))throw Error('Payment binding requires review')
 if(intent.status==='canceled')throw Error('This checkout was canceled. Start a new checkout.')
 await checkedRpc(db,'attach_secure_checkout',{p_id:identity.id,p_intent:intent.id})
 await attachSecureReferral(db,snapshot,intent)
 return {status:200,body:{orderId:snapshot.order_id,clientSecret:intent.client_secret,status:intent.status}}
}
export async function reconcileOrderPayment(db,stripe,intent,{failed=false}={}){
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
