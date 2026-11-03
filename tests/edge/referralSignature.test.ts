import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
const stripe=new Stripe('fixture-only',{apiVersion:'2023-10-16'})
const provider=Stripe.createSubtleCryptoProvider()
const secret='fixture-signing-secret-not-used-outside-this-test'
const body=JSON.stringify({id:'evt_fixture',type:'payment_intent.succeeded',livemode:false,data:{object:{id:'pi_fixture'}}})
const t=Math.floor(Date.now()/1000)
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${body}`))
const signature=`t=${t},v1=${Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}`
Deno.test('actual Stripe signature implementation accepts authentic fixture and rejects changed bodies',async()=>{
 const event=await stripe.webhooks.constructEventAsync(body,signature,secret,undefined,provider)
 if(event.id!=='evt_fixture')throw Error('Wrong event')
 for(const [value,header] of [[body+' ',signature],[body,''],[body,signature.replace('v1=','v1=00')]]){
  let rejected=false;try{await stripe.webhooks.constructEventAsync(value,header,secret,undefined,provider)}catch{rejected=true}
  if(!rejected)throw Error('Invalid signature accepted')
 }
})
