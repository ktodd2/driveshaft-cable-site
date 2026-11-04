// Composition only: this module never creates, confirms or cancels a Stripe intent.
import {rpc} from './referrals.js'
const canonical=value=>JSON.stringify(value,(_key,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry)
const name=value=>String(value??'').replace(/[\p{Cc}\s]+/gu,' ').trim().slice(0,160)||null
async function lookup(db,order){const {data,error}=await db.from('referral_checkouts').select('*').eq('order_id',order).maybeSingle();if(error)throw Error('Referral snapshot verification unavailable');return data}
export async function prepareSecureReferral(db,snapshot){
 if(snapshot.intent_params.metadata?.referral_system!=='v1')return null
 const order=snapshot.order_snapshot,params=snapshot.intent_params
 let existing=await lookup(db,snapshot.order_id)
 if(existing){
  if(existing.email!==order.email||existing.merchandise_cents!==order.subtotal_cents-order.discount_cents||existing.shipping_cents!==order.shipping_cents||existing.tax_cents!==order.tax_cents||canonical(existing.intent_params)!==canonical(params)||existing.buyer_name_captured&&existing.buyer_name!==name(order.name))throw Error('Referral snapshot binding changed')
  if(existing.intent_id&&snapshot.intent_id&&existing.intent_id!==snapshot.intent_id)throw Error('Referral intent binding changed')
  if(['observed','paid'].includes(existing.state)){
   if(!existing.intent_id||!existing.buyer_name_captured)throw Error('Referral payment requires review')
   return existing
  }
  if(existing.state!=='prepared')throw Error('Referral checkout requires review')
  if(existing.buyer_name_captured)return existing
 }
 existing=await rpc(db,'referral_prepare_named',{p_order:snapshot.order_id,p_email:order.email,p_buyer_name:name(order.name),p_code:params.metadata.referral_code||null,p_merch:order.subtotal_cents-order.discount_cents,p_shipping:order.shipping_cents,p_tax:order.tax_cents,p_params:params})
 return existing
}
export async function attachSecureReferral(db,snapshot,intent){
 if(snapshot.intent_params.metadata?.referral_system!=='v1')return
 let existing=await lookup(db,snapshot.order_id)
 if(!existing)throw Error('Referral checkout missing')
 if(['observed','paid'].includes(existing.state)&&existing.intent_id===intent.id)return
 try{await rpc(db,'referral_attach',{p_order:snapshot.order_id,p_intent:intent.id})}
 catch(error){existing=await lookup(db,snapshot.order_id);if(!existing||!['observed','paid'].includes(existing.state)||existing.intent_id!==intent.id)throw error}
}
