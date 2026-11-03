import {memoryDb} from './emailHealthDb.mjs'
export function statementDb(number=3){
 const db=memoryDb();db.tables.referral_settings=[{id:true,emails_enabled:true,auto_statements_enabled:true,statements_started_at:'2026-10-01T05:00:00Z'}]
 db.tables.referral_statements=Array.from({length:number},(_,i)=>({id:'statement-'+String(i+1).padStart(3,'0'),partner_id:'partner-'+i,month:'2026-11',created_at:'2026-11-03T15:00:00Z',recipient_email:`referrer${i}@invalid.test`,recipient_name:`Frozen Name ${i}`,referral_code:`CODE${i}10`,balance:{available:i===0?0:i===1?-100:1000,pending:0,held:0,reserved:0,paid:0,reversed:0}}))
 db.calls=[];db.lease=null
 db.rpc=async(name,args={})=>{
  db.calls.push([name,args]);const settings=db.tables.referral_settings[0]
  if(name==='referral_claim_statement_run'){
   if(db.lease||!settings.emails_enabled||!settings.auto_statements_enabled||!settings.statements_started_at)return {data:false}
   db.lease=args.p_run;return {data:true}
  }
  if(name==='referral_prepare_statements')return {data:{created:0,remaining:0,month:'2026-11',late:true}}
  if(name==='referral_statement_batch'){
   const claimed=id=>db.tables.email_attempts.filter(a=>a.automation==='referral-send-statement'&&a.entity_id===id)
   const rows=db.tables.referral_statements.filter(s=>!claimed(s.id).length)
   return {data:{rows:rows.slice(0,args.p_limit).map(s=>({id:s.id})),remaining:rows.length,held:db.tables.referral_statements.filter(s=>claimed(s.id).some(a=>a.status!=='accepted')).length}}
  }
  if(name==='referral_finish_statement_run'){
   if(db.lease===args.p_run){db.lease=null;db.lastCounts=args.p_counts}
   return {data:null}
  }
  throw Error('Unexpected RPC: '+name)
 }
 return db
}
