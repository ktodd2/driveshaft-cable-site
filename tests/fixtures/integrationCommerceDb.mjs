// Ephemeral PostgreSQL plus a narrow PostgREST-shaped service fixture. No hosted connections.
import fs from 'node:fs/promises'
import {build} from 'esbuild'
import {runInNewContext} from 'node:vm'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
export async function commerceFixture({policyRuntime=false,emailVerification=false,sqlAdapter=null}={}){
 const sql=sqlAdapter||new PGlite()
 await sql.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 alter default privileges in schema public grant select,insert,update on tables to service_role;
 create table admin_users(id uuid primary key,is_active boolean);alter table admin_users enable row level security;grant select on admin_users to authenticated;create policy own_admin on admin_users for select to authenticated using(id=auth.uid());
 create table orders(id uuid primary key default gen_random_uuid(),email text,name text,company text,phone text,shipping_address jsonb,items jsonb,subtotal_cents integer,discount_cents integer,discount_reason text,discount_code text,shipping_cents integer,tax_cents integer,stripe_tax_calculation_id text,stripe_tax_transaction_id text,total_cents integer,how_heard text,status text,payment_status text,payment_method text,stripe_payment_intent_id text,created_at timestamptz default now(),updated_at timestamptz default now(),stock_decremented boolean default false,reorder_reminder_sent_at timestamptz,winback_email_sent_at timestamptz,actual_shipping_cost_cents integer,tracking_number text,tracking_carrier text);
 create table products(id text primary key,name text,base_price_cents integer,tiers jsonb,is_active boolean,is_storefront boolean,min_order_quantity integer,order_quantity_step integer);
 create table product_inventory(product_id text primary key,stock_quantity integer,updated_at timestamptz);create table sales(id uuid primary key default gen_random_uuid(),name text,discount_percent integer,scope text,product_id text,starts_at timestamptz,ends_at timestamptz,is_active boolean);
 create table discount_redemptions(id uuid default gen_random_uuid(),code text,email text,order_id uuid,unique(code,email));create table cart_abandonments(id uuid primary key default gen_random_uuid(),email text,email_sent_at timestamptz);create table newsletter_subscribers(id uuid primary key default gen_random_uuid(),email text,welcome_stage integer);
 alter table orders enable row level security;grant all on orders to anon,authenticated,service_role;
 create policy "Allow reading own orders" on orders for select to anon using(true);create policy "Allow anonymous inserts" on orders for insert to anon with check(true);create policy "Allow anonymous payment status updates" on orders for update to anon using(true) with check(true);
 create policy "Admin can view all orders" on orders for select to authenticated using(true);create policy "Admin can insert orders" on orders for insert to authenticated with check(true);create policy "Admin can update orders" on orders for update to authenticated using(true);`)
 for(const file of ['orders_decrement_stock_trigger.sql','20261101010000_shipping_import_review.sql','20261101030000_email_health.sql','20261103003157_referral_rewards.sql','20261103010645_referral_automatic_statements.sql','20261103011248_secure_checkout_service.sql','20261103011310_orders_least_privilege.sql','20261103012437_referral_statement_customer_details.sql','20261103013111_referral_code_choices.sql','20261103020100_referral_ambiguous_history_hold.sql'])await sql.exec(await fs.readFile('supabase/migrations/'+file,'utf8'))
 if(policyRuntime)for(const file of ['20261103143717_referral_code_policy.sql','20261103143732_referral_policy_checkout_runtime.sql'])await sql.exec(await fs.readFile('supabase/migrations/'+file,'utf8'))
 if(emailVerification)await sql.exec(await fs.readFile('supabase/migrations/20261103145323_buyer_email_verification.sql','utf8'))
 const owner='90000000-0000-4000-8000-000000000001'
 await sql.query('insert into admin_users values($1,true)',[owner])
 await sql.exec("insert into products values('1','Fixture Cable',500,'[]',true,true,10,1);insert into product_inventory values('1',100000,now())")
 await sql.exec('set role service_role')
 const calls=[]
 const ident=value=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw Error('Invalid fixture SQL identifier');return '"'+value+'"'}
 const db={rpc:async(name,args={})=>{calls.push({name,args});try{const entries=Object.entries(args);const q=`select ${ident(name)}(${entries.map(([key],i)=>ident(key)+' => $'+(i+1)).join(',')}) result`;return {data:(await sql.query(q,entries.map(([,value])=>Array.isArray(value)?JSON.stringify(value):value))).rows[0].result}}catch(error){return {error:{message:error.message,code:error.code}}}},from(table){
  ident(table);let op='read',payload,selection='*',single=false,maybe=false,limit=null,filters=[]
  const q={select(value='*'){selection=value;return q},eq(key,value){filters.push([key,'=',value]);return q},in(key,value){filters.push([key,'in',value]);return q},lte(key,value){filters.push([key,'<=',value]);return q},gt(key,value){filters.push([key,'>',value]);return q},limit(value){limit=value;return q},single(){single=true;return q},maybeSingle(){maybe=true;return q},insert(value){op='insert';payload=value;return q},update(value){op='update';payload=value;return q},then(resolve,reject){return (async()=>{try{
   const params=[];const columns=selection==='*'?'*':selection.split(',').map(ident).join(',');let statement
   if(op==='insert'){const keys=Object.keys(payload);params.push(...keys.map(key=>payload[key]));statement=`insert into ${ident(table)}(${keys.map(ident).join(',')})values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning ${columns}`}
   else{const where=filters.map(([key,operator,value])=>{if(operator==='in'){params.push(value);return `${ident(key)}=any($${params.length})`}params.push(value);return `${ident(key)}${operator}$${params.length}`}).join(' and ')
    if(op==='update'){const assignments=Object.entries(payload).map(([key,value])=>{params.push(value);return `${ident(key)}=$${params.length}`});statement=`update ${ident(table)} set ${assignments.join(',')}${where?' where '+where:''} returning *`}
    else statement=`select ${columns} from ${ident(table)}${where?' where '+where:''}${limit?' limit '+Number(limit):''}`
   }
   const rows=(await sql.query(statement,params)).rows
   if(single&&rows.length!==1)return {error:{message:'Expected one fixture row',code:'PGRST116'}}
   return {data:single||maybe?rows[0]||null:rows}
  }catch(error){return {error:{message:error.message,code:error.code}}}})().then(resolve,reject)}};return q
 }}
 const intents=new Map(),keys=new Map(),payments=[],taxes=[]
 const stripe={paymentIntents:{create:async(params,{idempotencyKey})=>{payments.push({params:structuredClone(params),idempotencyKey});if(!keys.has(idempotencyKey)){const id='pi_fixture'+(intents.size+1),value={id,client_secret:id+'_secret_fixture',status:'requires_payment_method',livemode:true,...structuredClone(params)};keys.set(idempotencyKey,id);intents.set(id,value)}return structuredClone(intents.get(keys.get(idempotencyKey)))},retrieve:async id=>{if(!intents.has(id))throw Error('Unknown fixture intent');return structuredClone(intents.get(id))}},tax:{calculations:{create:async params=>({id:'taxcalc_fixture_'+(taxes.push(params)),tax_amount_exclusive:375})},transactions:{createFromCalculation:async()=>({id:'tax_fixture'})}},disputes:{list:async()=>({data:[],has_more:false})},charges:{retrieve:async id=>[...intents.values()].map(i=>i.latest_charge).find(c=>c?.id===id)}}
 function succeed(id,at=Math.floor(Date.now()/1000)){const intent=intents.get(id);Object.assign(intent,{status:'succeeded',amount_received:intent.amount,latest_charge:{id:'ch_'+id,paid:true,created:at,amount_refunded:0,disputed:false}});return {id:'evt_'+id,type:'payment_intent.succeeded',livemode:true,created:at,data:{object:{id}}}}
 const compiled=await build({entryPoints:['supabase/functions/_shared/checkoutPricing.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'offline-types',setup(b){b.onResolve({filter:/^https:/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>{throw Error("network forbidden")};export default class Stripe{}',loader:'js'}))}}]})
 const module={exports:{}};runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,Date,Error,Map,Math,Number,console:{warn(){},error(){}}})
 stripe.paymentIntents.cancel=async id=>{const intent=intents.get(id);if(!intent||!['requires_payment_method','requires_confirmation','requires_action','canceled'].includes(intent.status))throw Error('Provider cannot cancel');intent.status='canceled';return structuredClone(intent)}
 // Without policyRuntime this intentionally models the historical no-buyer-discount pricing for legacy regression fixtures only.
 return {sql,db,stripe,owner,calls,intents,payments,taxes,succeed,price:input=>module.exports.priceCheckout(db,stripe,policyRuntime?input:{...input,referralCode:undefined},{failTaxOpen:true,referralEnabled:policyRuntime,buyerVerificationEnabled:emailVerification})}
}
