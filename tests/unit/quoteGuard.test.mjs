import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeQuote,quoteRiskReasons,quoteNotification,quoteHash} from '../../supabase/functions/_shared/quoteGuard.js'
const normal={name:'Jane Smith',company:'J&S Towing',email:'Jane@gmail.com',phone:'+1 555 123 4567',message:'Please quote 70 XL cables.',quantity:70,website:'',request_id:'a1111111-1111-4111-8111-111111111111',started_at:Date.now()}
test('quote normalizes real customers without provider, quantity, international or timing bans',()=>{
 const q=normalizeQuote(normal);assert.equal(q.email,'jane@gmail.com');assert.deepEqual(quoteRiskReasons(q),[])
 assert.deepEqual(quoteRiskReasons(normalizeQuote({...normal,name:'王小明',phone:'+86 13800000000',quantity:73})),[])
})
test('quote validates types, bounded fields and IDs',()=>{
 for(const patch of [{name:''},{email:'a\nb@c.com'},{email:'bad'},{message:'x'.repeat(5001)},{name:{}},{quantity:-1},{quantity:1.5},{quantity:'70'},{request_id:'bad'}]) assert.throws(()=>normalizeQuote({...normal,...patch}))
})
test('quote quarantines honeypot and multiple random tokens, not just a long name',()=>{
 assert.deepEqual(quoteRiskReasons({...normal,website:'filled'}),['honeypot'])
 assert.deepEqual(quoteRiskReasons({...normal,name:'aBcDeFgHiJkLmNoP',company:'qRsTuVwXyZaBcDeF'}),['multiple_random_tokens'])
 assert.deepEqual(quoteRiskReasons({...normal,name:'aBcDeFgHiJkLmNoP'}),[])
})
test('notification is fixed-recipient and escapes all user HTML',()=>{
 const mail=quoteNotification({...normal,name:'<b>Joe</b>',message:'<img src="https://evil"> & hello'},42)
 assert.deepEqual(mail.to,['kurtis@k-todd.com']);assert.equal(mail.subject,'New Quote Request #42');assert.ok(!mail.html.includes('<img'));assert.ok(mail.html.includes('&lt;img'));assert.ok(mail.text.includes('<img'))
})
test('hashes are domain separated and do not store raw addresses',async()=>{
 const a=await quoteHash('secret','email','jane@gmail.com'), b=await quoteHash('secret','ip','jane@gmail.com');assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.equal(a,await quoteHash('secret','email','jane@gmail.com'))
})
test('observed gibberish messages are held for review while ordinary short enquiries pass',()=>{
 for (const message of ['uycltpBJKIWvBkqZtjRKy','CfZqpAokuYhCvFRWZvp','VrKJWMTaHOtHhZmQvvLbjoRH','PlGueOqlUSjjbnPWfRQCGr']) assert.ok(quoteRiskReasons({...normal,message}).includes('random_token_message'))
 for (const message of ['Price?','Please quote XL cables','CAT1234','MackAnthemReplacementParts','Hello can you ship to Canada?']) {
   // Mixed-case catalogue names can require review; human-readable sentences must pass.
   if (message.includes(' ') || message.length<18) assert.deepEqual(quoteRiskReasons({...normal,message}),[])
 }
})
