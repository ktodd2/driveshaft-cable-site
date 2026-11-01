import React from 'react'
import {createRoot} from 'react-dom/client'
import {InventoryPlanningView} from '../../src/components/admin/InventoryPlanning'
import '../../src/index.css'
import {readSharedPlan,writeSharedPlan} from '../../src/lib/inventoryPlanStorage'
const mode=new URLSearchParams(location.search).get('mode')
const date=new Date();date.setUTCDate(date.getUTCDate()-2)
const data={products:[{id:'1',name:'Regular · 1000 mm'},{id:'xl',name:'XL · 1500 mm'}],inventory:[{product_id:'1',stock_quantity:10},{product_id:'xl',stock_quantity:0}],orders:[{id:'o',created_at:date.toISOString(),payment_status:'paid',status:'confirmed',items:[{productId:'1',quantity:30}]}],receipts:[{id:'receipt-fixture',product_id:'1',quantity:40,received_at:date.toISOString()}],loadedAt:new Date(Date.now()-(mode==='stale'?16*60000:0)),refresh:()=>location.reload()}
if(mode==='error')data.error='Inventory planning data unavailable. Forecasts withheld; retry to load a complete snapshot.'
if(mode==='loading')data.loading=true
if(mode==='shared'){const client={rpc:async(name,args)=>{const r=await fetch('/__plan/'+name,{method:'POST',body:JSON.stringify(args||{})});return r.json()}};data.readShared=()=>readSharedPlan(client);data.writeShared=r=>writeSharedPlan(client,r)}
createRoot(document.getElementById('root')).render(<div className="bg-gray-950 p-4"><InventoryPlanningView data={data}/></div>)
