import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
create table admin_users(id uuid primary key,is_active boolean);alter table admin_users enable row level security;grant select on admin_users to authenticated,service_role;create policy own_admin on admin_users for select to authenticated using(id=auth.uid());
create table orders(id uuid primary key default gen_random_uuid(),email text,name text,company text,phone text,shipping_address jsonb,items jsonb,subtotal_cents integer,discount_cents integer,discount_reason text,discount_code text,shipping_cents integer,tax_cents integer,stripe_tax_calculation_id text,stripe_tax_transaction_id text,total_cents integer,how_heard text,status text,payment_status text,payment_method text,stripe_payment_intent_id text,created_at timestamptz default now(),updated_at timestamptz default now(),stock_decremented boolean default false,reorder_reminder_sent_at timestamptz,winback_email_sent_at timestamptz,actual_shipping_cost_cents integer,tracking_number text,tracking_carrier text);
create table product_inventory(product_id text primary key,stock_quantity integer,updated_at timestamptz);insert into product_inventory values('1',100,now());
create table discount_redemptions(code text,email text,order_id uuid,unique(code,email));create table cart_abandonments(email text,email_sent_at timestamptz);create table newsletter_subscribers(welcome_stage integer);
alter table orders enable row level security;grant all on orders to anon,authenticated,service_role;grant select,insert,update on product_inventory,discount_redemptions to service_role;grant select on product_inventory to authenticated;
create policy "Allow reading own orders" on orders for select to anon using(true);create policy "Allow anonymous inserts" on orders for insert to anon with check(true);create policy "Allow anonymous payment status updates" on orders for update to anon using(true) with check(true);
create policy "Admin can view all orders" on orders for select to authenticated using(true);create policy "Admin can insert orders" on orders for insert to authenticated with check(true);create policy "Admin can update orders" on orders for update to authenticated using(true);`)
await db.exec(await fs.readFile('supabase/migrations/orders_decrement_stock_trigger.sql','utf8'))
await db.exec(await fs.readFile('supabase/migrations/20261103011248_secure_checkout_service.sql','utf8'))
await db.exec(await fs.readFile('supabase/migrations/20261103011310_orders_least_privilege.sql','utf8'))
await db.exec(await fs.readFile('supabase/migrations/20261101010000_shipping_import_review.sql','utf8'))
const owner='10000000-0000-4000-8000-000000000001',inactive='10000000-0000-4000-8000-000000000002',ordinary='10000000-0000-4000-8000-000000000003'
await db.query('insert into admin_users values($1,true),($2,false)',[owner,inactive])
const id='20000000-0000-4000-8000-000000000001',cap='a'.repeat(64),fingerprint='b'.repeat(64)
const order={email:'fixture@invalid.test',name:'Fixture Customer',items:[{productId:'1',name:'Product',quantity:10,price:500}],shipping_address:{state:'TX',zip:'77001'},subtotal_cents:5000,discount_cents:250,discount_reason:'Discount code WELCOME5',discount_code:'WELCOME5',shipping_cents:2000,tax_cents:400,total_cents:7150,stripe_tax_calculation_id:'taxcalc_fixture'}
const params={amount:7150,currency:'usd',receipt_email:order.email,metadata:{order_id:'pending',secure_checkout_id:id}}
await db.exec('set role service_role')
const prepare=async(c=cap,f=fingerprint)=>(await db.query('select prepare_secure_checkout($1,$2,$3,$4,$5) result',[id,c,f,order,params])).rows[0].result
const snapshots=await Promise.all([prepare(),prepare()]);assert.equal(snapshots[0].order_id,snapshots[1].order_id)
const snapshot=snapshots[0]
assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,1)
await assert.rejects(()=>prepare('c'.repeat(64)),/capability/)
await assert.rejects(()=>prepare(cap,'d'.repeat(64)),/details/)
await db.query("select attach_secure_checkout($1,'pi_fixture')",[id])
await assert.rejects(()=>db.query("select attach_secure_checkout($1,'pi_other')",[id]),/binding/)
const pay=(amount=7150,email=order.email,checkout=id,pi='pi_fixture',success=true)=>db.query('select apply_verified_order_payment($1,$2,$3,$4,$5,$6,$7,$8,$9)',[snapshot.order_id,pi,amount,'usd',email,checkout,success,[{productId:'1',quantity:10}],'taxcalc_fixture'])
await assert.rejects(()=>pay(1),/amount|identity/);await assert.rejects(()=>pay(7150,'other@invalid.test'),/identity/);await assert.rejects(()=>pay(7150,order.email,null),/binding/)
await Promise.all([pay(),pay()])
assert.equal((await db.query('select stock_quantity from product_inventory')).rows[0].stock_quantity,90,'stock decremented once')
assert.equal((await db.query('select count(*)::int n from discount_redemptions')).rows[0].n,1)
await pay(7150,order.email,id,'pi_fixture',false)
assert.equal((await db.query('select payment_status from orders')).rows[0].payment_status,'paid','stale failed event cannot undo success')
const tax=await Promise.all([db.query('select claim_order_tax($1) result',[snapshot.order_id]),db.query('select claim_order_tax($1) result',[snapshot.order_id])]);assert.equal(tax.filter(x=>x.rows[0].result).length,1)
await db.query("select record_order_tax($1,'tax_fixture')",[snapshot.order_id]);assert.equal((await db.query('select claim_order_tax($1) result',[snapshot.order_id])).rows[0].result,null)
await db.exec('reset role')
for(const [role,user] of [['anon',''],['authenticated',ordinary],['authenticated',inactive]]){
 await db.query("select set_config('app.uid',$1,false)",[user]);await db.exec(`set role ${role}`)
 if(role==='anon')await assert.rejects(()=>db.query('select * from orders'),/permission denied/)
 else assert.equal((await db.query('select * from orders')).rows.length,0)
 await assert.rejects(()=>db.query("insert into orders(email)values('forged@invalid.test')"),/permission denied|row-level security/)
 if(role==='anon')await assert.rejects(()=>db.query("update orders set payment_status='paid'"),/permission denied/)
 else assert.equal((await db.query("update orders set payment_status='paid' returning id")).rows.length,0)
 for(const table of ['checkout_requests','order_payment_receipts'])await assert.rejects(()=>db.query(`select * from ${table}`),/permission denied/)
 for(const fn of ['prepare_secure_checkout','attach_secure_checkout','apply_verified_order_payment','claim_order_tax','record_order_tax','checkout_repeat_customer']){
  assert.equal((await db.query('select bool_or(has_function_privilege(current_user,p.oid,\'EXECUTE\')) allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=\'public\' and p.proname=$1',[fn])).rows[0].allowed,false)
 }
 await assert.rejects(()=>db.query('delete from orders'),/permission denied/);await assert.rejects(()=>db.query('truncate orders cascade'),/permission denied/)
 await assert.rejects(()=>db.query('select get_email_automation_stats()'),/permission denied|Active admin/)
 await db.exec('reset role')
}
await db.query("select set_config('app.uid',$1,false)",[owner]);await db.exec('set role authenticated')
assert.equal((await db.query('select * from orders')).rows.length,1)
const manual='30000000-0000-4000-8000-000000000001'
await db.query("insert into orders(id,email,name,payment_method,payment_status,status,items,total_cents)values($1,'manual@invalid.test','Manual','cash','pending','confirmed',$2,500)",[manual,[{productId:'1',quantity:1,price:500}]])
await db.query("update orders set payment_status='paid' where id=$1",[manual])
await db.query("update orders set status='shipped',tracking_number='TRACK',tracking_carrier='ups',actual_shipping_cost_cents=100 where id=$1",[snapshot.order_id])
assert.equal((await db.query('select stock_quantity from product_inventory')).rows[0].stock_quantity,89,'manual stock trigger still works without direct function EXECUTE')
assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,2,'admin reporting still reads orders')
assert.equal((await db.query('select * from get_email_automation_stats()')).rows.length,1)
const shipping=(await db.query('select apply_shipping_import($1,$2,$3,$4,$5,$6) result',[snapshot.order_id,100,'TRACK','TRACK',[{source_key:'e'.repeat(64),cost_cents:200,tracking_number:'TRACK'}],'fixture.csv'])).rows[0].result
assert.ok(shipping)
await assert.rejects(()=>db.query('delete from orders where id=$1',[manual]),/permission denied/)
await db.exec('reset role')
assert.equal((await db.query("select has_table_privilege('anon','orders','TRUNCATE') allowed")).rows[0].allowed,false)
assert.equal((await db.query("select has_table_privilege('authenticated','orders','TRUNCATE') allowed")).rows[0].allowed,false)
// Legacy fulfillment uses immutable Stripe financial evidence, never formerly public tax references.
const legacy='40000000-0000-4000-8000-000000000001'
await db.query("insert into orders(id,email,name,payment_method,payment_status,status,items,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents,stripe_tax_calculation_id,stripe_tax_transaction_id) values($1,'legacy@invalid.test','Legacy','stripe','pending','pending',$2,5000,250,2100,300,7150,'forged-calculation','forged-transaction')",[legacy,order.items])
await db.exec('set role service_role')
const financial={v:2,s:5000,d:250,h:2000,t:400,i:[['1',10,500,'Catalog Product']]}
const legacyPay=()=>db.query("select apply_verified_order_payment($1,'pi_legacy',7150,'usd','legacy@invalid.test',null,true,$2,'taxcalc_authoritative',$3) result",[legacy,[{productId:'1',quantity:10}],financial])
await assert.rejects(legacyPay,/financial snapshot/)
await db.exec('reset role');await db.query('update orders set shipping_cents=2000,tax_cents=400 where id=$1',[legacy]);await db.exec('set role service_role')
await legacyPay()
const receipt=(await db.query('select tax_calculation_id,tax_transaction_id,tax_state from order_payment_receipts where order_id=$1',[legacy])).rows[0]
assert.equal(receipt.tax_calculation_id,'taxcalc_authoritative');assert.equal(receipt.tax_transaction_id,null);assert.equal(receipt.tax_state,'review');assert.equal((await db.query('select claim_order_tax($1) result',[legacy])).rows[0].result,null)
const receiptCount=(await db.query('select count(*)::int n from order_payment_receipts')).rows[0].n
await legacyPay();assert.equal((await db.query('select count(*)::int n from order_payment_receipts')).rows[0].n,receiptCount)
await db.exec('reset role')
await db.close();console.log('PASS local Postgres: private capabilities, replay/races, stock/discount/tax once, anon/nonadmin denial, active-admin manual/status/report/shipping preservation')
