import test from 'node:test'
import assert from 'node:assert/strict'
import {readSharedPlan,writeSharedPlan,storageError,planSignature} from '../../src/lib/inventoryPlanStorage.js'
test('absent backend and inactive admin are explicit definitive failures',async()=>{
 for(const code of ['PGRST202','42883','42501','40001','P0001']){
  const e=storageError({code,message:'validation'});assert.equal(e.definitive,true)
  await assert.rejects(()=>readSharedPlan({rpc:async()=>({error:{code}})}))
 }
})
test('unknown/failed transport cannot claim success; exact requests are retained by caller',async()=>{
 const request={p_request_id:'stable',p_expected_revision:3,p_document:{lines:[]}}
 let received
 const client={rpc:async(name,r)=>{received=r;return {error:{message:'network'}}}}
 await assert.rejects(()=>writeSharedPlan(client,request),e=>!e.definitive)
 assert.equal(received,request)
 await assert.rejects(()=>writeSharedPlan({rpc:async()=>({data:{}})},request),/uncertain/)
 const result=await writeSharedPlan({rpc:async()=>({data:{status:'already_saved',revision:4,current_revision:5}})},request)
 assert.equal(result.current_revision,5)
})

test('JSONB key ordering does not mark a loaded plan dirty',()=>{
 const a={days:30,lead:'',safety:'',lines:[{id:'a',quantity:10,receiptIds:[]}]}
 const b={lines:[{receiptIds:[],quantity:10,id:'a'}],safety:'',lead:'',days:30}
 assert.equal(planSignature(a),planSignature(b))
 assert.notEqual(planSignature(a),planSignature({...b,lead:'45'}))
})
