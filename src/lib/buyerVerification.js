const KEY='dsc-buyer-email-proof-v1',PENDING='dsc-buyer-email-confirmation-v1',CHANNEL='dsc-buyer-email-verification'
const normalize=value=>String(value||'').trim().toLowerCase()
const hex=/^[a-f0-9]{64}$/
const random=browser=>Array.from((browser.crypto||crypto).getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
function read(key,browser){try{return JSON.parse(browser.sessionStorage.getItem(key))}catch{return null}}
function write(key,value,browser){try{browser.sessionStorage.setItem(key,JSON.stringify(value))}catch{/* Memory fallback in this tab. */}}
export function getBuyerVerification(email=null,browser=typeof window==='undefined'?null:window,now=Date.now()){
 if(!browser)return null
 const proof=browser.__buyerEmailProof||read(KEY,browser)
 if(!proof||!hex.test(proof.token||'')||!proof.email||!Number.isFinite(proof.expiresAt)||proof.expiresAt<=now||proof.expiresAt>now+3600000+30000)return null
 if(email!==null&&normalize(email)!==proof.email)return null
 return proof
}
export function saveBuyerVerification(value,browser=typeof window==='undefined'?null:window,now=Date.now()){
 const proof={email:normalize(value.email),token:value.token,expiresAt:value.expiresAt??Date.parse(value.expires_at)}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proof.email)||!hex.test(proof.token||'')||!Number.isFinite(proof.expiresAt)||proof.expiresAt<=now||proof.expiresAt>now+3600000+30000)return null
 browser.__buyerEmailProof=proof;write(KEY,proof,browser);return proof
}
export function buyerVerificationCanReload(browser=typeof window==='undefined'?null:window,now=Date.now()){
 if(!browser)return false
 const proof=getBuyerVerification(null,browser,now),stored=read(KEY,browser)
 return !!proof&&stored?.token===proof.token&&stored?.email===proof.email&&stored?.expiresAt===proof.expiresAt
}
export function forgetBuyerVerification(email,browser=typeof window==='undefined'?null:window){
 const current=getBuyerVerification(null,browser)
 if(current&&current.email!==normalize(email))return
 delete browser.__buyerEmailProof;try{browser.sessionStorage.removeItem(KEY)}catch{}
}
export function pendingBuyerVerification(browser=typeof window==='undefined'?null:window,now=Date.now()){
 const pending=browser.__buyerEmailConfirmation||read(PENDING,browser)
 return pending&&hex.test(pending.token||'')&&hex.test(pending.proofToken||'')&&Number.isFinite(pending.createdAt)&&pending.createdAt<=now+30000&&pending.createdAt>now-3600000?pending:null
}
export function buyerVerificationAttempt(token,browser=typeof window==='undefined'?null:window,now=Date.now()){
 if(!hex.test(token||''))throw Error('Verification link unavailable')
 const previous=pendingBuyerVerification(browser,now)
 const attempt=previous?.token===token?previous:{token,proofToken:random(browser),createdAt:now}
 browser.__buyerEmailConfirmation=attempt;write(PENDING,attempt,browser);return attempt
}
export function clearBuyerVerificationAttempt(browser=typeof window==='undefined'?null:window){delete browser.__buyerEmailConfirmation;try{browser.sessionStorage.removeItem(PENDING)}catch{}}
export function announceBuyerVerification(proof,browser=typeof window==='undefined'?null:window){
 if(typeof browser.BroadcastChannel!=='function')return
 const channel=new browser.BroadcastChannel(CHANNEL);channel.postMessage({type:'buyer-email-proof',...proof});channel.close()
}
export function listenForBuyerVerification(email,onProof,browser=typeof window==='undefined'?null:window){
 if(typeof browser.BroadcastChannel!=='function')return ()=>{}
 const channel=new browser.BroadcastChannel(CHANNEL)
 channel.onmessage=event=>{const value=event.data;if(value?.type!=='buyer-email-proof'||normalize(value.email)!==normalize(email))return;const proof=saveBuyerVerification(value,browser);if(proof)onProof(proof)}
 return ()=>channel.close()
}
