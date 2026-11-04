import React,{useEffect,useState} from 'react'
import {DEFAULT_REFERRAL_POLICY,validReferralPolicy,referralPolicyDescription} from '../../../supabase/functions/_shared/referralPolicy.js'
const percent=value=>String(value/100)
const basisPoints=value=>/^\d+(?:\.\d{1,2})?$/.test(value)?Math.round(Number(value)*100):NaN
export default function ReferralCodePolicy({partner,busy,onSave}) {
 const [discount,setDiscount]=useState('5'),[tiers,setTiers]=useState([]),[error,setError]=useState(''),[confirm,setConfirm]=useState(false)
 useEffect(()=>{setDiscount(percent(partner.buyer_discount_bps??500));setTiers((partner.commission_tiers||DEFAULT_REFERRAL_POLICY.tiers).map(t=>({through:String(t.through),percent:percent(t.bps)})));setError('');setConfirm(false)},[partner.id,partner.policy_revision])
 const policy={buyer_discount_bps:basisPoints(discount),tiers:tiers.map(t=>({through:/^\d+$/.test(t.through)?Number(t.through):NaN,bps:basisPoints(t.percent)}))}
 const edit=(index,key,value)=>{setConfirm(false);setTiers(tiers.map((tier,i)=>i===index?{...tier,[key]:value}:tier))}
 return <section aria-label="Code reward settings" className="border border-gray-700 p-4 space-y-3"><h2 className="text-xl text-white">Settings for {partner.code}</h2>
 <p className="text-sm text-gray-400">Discounts apply to eligible products only. Tax and shipping never earn commission. A discount combination that makes the entire order total $0 requires owner assistance; checkout creates no payment for it. Saved policy versions and previously earned rates remain in history.</p>
 <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(!validReferralPolicy(policy)){setError('Enter percentages from 0 to 100 with at most two decimal places. Tier end orders must be increasing whole numbers.');return}setError('');setConfirm(true)}}>
 <label className="block">First-order buyer discount (%)<input required type="number" min="0" max="100" step="0.01" className="input-field block" value={discount} onChange={e=>{setDiscount(e.target.value);setConfirm(false)}}/></label>
 <p>Commission schedule — each referred buyer has their own order count:</p>
 {tiers.map((tier,index)=><div className="flex flex-wrap gap-3 items-end" key={index}><label>Through paid order<input required type="number" min="1" max="2147483647" step="1" className="input-field block" value={tier.through} onChange={e=>edit(index,'through',e.target.value)}/></label><label>Commission (%)<input required type="number" min="0" max="100" step="0.01" className="input-field block" value={tier.percent} onChange={e=>edit(index,'percent',e.target.value)}/></label><button type="button" className="underline" disabled={busy||tiers.length===1} onClick={()=>{setTiers(tiers.filter((_,i)=>i!==index));setConfirm(false)}}>Remove tier {index+1}</button></div>)}
 <p className="text-sm">Orders after the final tier earn 0%. Attribution remains linked to the customer.</p>
 <div className="flex gap-3"><button type="button" className="btn-secondary" disabled={busy||tiers.length>=20} onClick={()=>{setTiers([...tiers,{through:String(Number(tiers.at(-1)?.through||0)+10),percent:'0'}]);setConfirm(false)}}>Add tier</button><button disabled={busy} className="btn-secondary">Review settings</button></div>
 </form>{error&&<p role="alert" className="text-red-300">{error}</p>}
 {confirm&&<div className="border border-yellow-600 p-3 space-y-3"><p>{referralPolicyDescription(policy)}</p><p className="text-sm">Changes apply to newly prepared orders, including future orders from existing referred customers. Checkouts already prepared keep their terms. Earned commissions and refund rates stay unchanged. This sends no email or payout.</p><button disabled={busy} className="btn-primary" onClick={async()=>{if(await onSave({partner_id:partner.id,expected_revision:partner.policy_revision,buyer_discount_bps:policy.buyer_discount_bps,tiers:policy.tiers}))setConfirm(false)}}>Save code settings</button></div>}
 </section>
}
