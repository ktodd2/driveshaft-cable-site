import test from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import {calcOrderProfit,calcProfitStats,calcWeightedAvgCostByProduct,scopeOrdersToProduct,calcPerProductStats} from '../../src/lib/costCalculations.js'
import {filterReportOrders,bookkeepingRows,BOOKKEEPING_COLUMNS,safeCsvCell} from '../../src/lib/profitReporting.js'
const order={id:'stable-id',created_at:'2026-11-01T12:00:00Z',payment_status:'paid',status:'confirmed',payment_method:'stripe',total_cents:1250,tax_cents:50,subtotal_cents:1200,discount_cents:100,shipping_cents:100,actual_shipping_cost_cents:100,items:[{productId:'1',quantity:2,price:400},{productId:'2',quantity:1,price:400}]}
const costs={'1':100,'2':300}
test('shared totals use per-product costs, ex-tax discounted revenue and estimated fees',()=>{
 const r=calcOrderProfit(order,costs)
 assert.deepEqual([r.revenue,r.productCost,r.shippingCost,r.stripeFee,r.profit],[1200,500,100,66,534])
 assert.equal(calcProfitStats([order],costs).netProfit,534)
 // Blending these costs would incorrectly price all three units the same.
 assert.notEqual(r.productCost,3*200)
})
test('unknown differs from recorded zero; fallback never fabricates an actual cost',()=>{
 const missing={...order,actual_shipping_cost_cents:null}
 assert.equal(calcOrderProfit(missing,costs).profit,null)
 assert.equal(calcOrderProfit({...order,actual_shipping_cost_cents:0},costs).profit,634)
 const estimate=calcOrderProfit(missing,costs,200)
 assert.equal(estimate.shippingKnown,false);assert.equal(estimate.shippingEstimated,true);assert.equal(estimate.profit,434)
 assert.equal(calcOrderProfit(missing,costs,-100).profit,null)
 assert.equal(calcOrderProfit({...order,actual_shipping_cost_cents:-1},costs,100).profit,null)
 assert.equal(calcOrderProfit(order,{'1':0,'2':0}).productCost,0)
 assert.equal(calcOrderProfit(order,{'1':0}).profit,null)
 for(const field of ['tax_cents','total_cents'])assert.equal(calcOrderProfit({...order,[field]:null},costs).profit,null)
 assert.equal(calcOrderProfit({...order,payment_method:'unknown'},costs).profit,null)
 assert.equal(calcProfitStats([order,missing],costs).netProfit,null)
 assert.equal(calcProfitStats([order,missing],costs).totalShippingCost,null)
})
test('weighted receipts distinguish absent product from zero; changing receipts is an explicit current estimate',()=>{
 const rows=[{product_id:'1',quantity:2,total_cost_cents:200},{product_id:'1',quantity:2,total_cost_cents:400},{product_id:'2',quantity:2,total_cost_cents:0},{product_id:'3',quantity:0,total_cost_cents:100}]
 assert.deepEqual(calcWeightedAvgCostByProduct(rows),{'1':150,'2':0})
 assert.equal(calcOrderProfit(order,calcWeightedAvgCostByProduct(rows)).productCost,300)
 assert.equal(order.items[0].price,400)
})
test('product allocations reconcile integer cents, duplicate product lines, zero-price carts and fixed fees',()=>{
 for(let cents=0;cents<100;cents++){
 const o={...order,total_cents:cents,tax_cents:0,actual_shipping_cost_cents:7,items:[...order.items,{productId:'1',quantity:1,price:400}]}
 const slices=scopeOrdersToProduct(o,costs)
 const r=calcOrderProfit(o,costs)
 for(const key of ['revenue','shippingCost','stripeFee','productCost','profit'])assert.equal(slices.reduce((s,x)=>s+x._report[key],0),r[key])
 assert.equal(slices[0].items.length,2)
 const by=calcPerProductStats([o],costs);assert.equal(by['1'].profit+by['2'].profit,r.profit)
 }
 const zero={...order,items:order.items.map(i=>({...i,price:0}))}
 assert.equal(scopeOrdersToProduct(zero,costs).length,2)
 assert.ok(scopeOrdersToProduct({...order,actual_shipping_cost_cents:null},costs).every(o=>o._report.profit===null))
})
test('UTC dates share exact boundaries, custom end includes milliseconds, and eligibility excludes known issues',()=>{
 const now=new Date('2026-11-01T15:00:00Z')
 const dates=['2026-10-02T23:59:59.999Z','2026-10-03T00:00:00Z','2026-11-01T23:59:59.999Z','2026-11-02T00:00:00Z']
 assert.deepEqual(filterReportOrders(dates.map(created_at=>({...order,created_at})),'30d','','',now).map(o=>o.created_at),dates.slice(1,3))
 assert.equal(filterReportOrders([{...order,created_at:dates[2]}],'custom','','2026-11-01',now).length,1)
 assert.equal(filterReportOrders([order],'custom','2026-11-02','2026-11-01',now).length,0)
 for(const patch of [{status:'cancelled'},{status:'closed'},{status:'refunded'},{payment_status:'refunded'},{is_test:true},{test_mode:true},{livemode:false},{refunded_at:'2026-11-01'},{refunded_amount_cents:1}])assert.equal(filterReportOrders([{...order,...patch}],'all','','',now).length,0)
 for(const status of ['confirmed','shipped','delivered'])assert.equal(filterReportOrders([{...order,status}],'all','','',now).length,1)
})
test('bookkeeping schema preserves gross components, unknown blanks, IDs and refund uncertainty; CSV is safe',()=>{
 const rows=bookkeepingRows([{...order,id:' =HYPERLINK("bad")',actual_shipping_cost_cents:null}],costs)
 assert.equal(rows[0].subtotal_cents,1200);assert.equal(rows[0].discount_cents,100);assert.equal(rows[0].shipping_charged_cents,100);assert.equal(rows[0].tax_cents,50)
 assert.equal(rows[0].actual_shipping_cost_cents,null);assert.equal(rows[0].contribution_estimate_cents,null);assert.equal(rows[0].refund_status,'unreconciled')
 const csv=Papa.unparse({fields:BOOKKEEPING_COLUMNS,data:rows.map(row=>BOOKKEEPING_COLUMNS.map(k=>safeCsvCell(row[k])))},{escapeFormulae:true})
 const parsed=Papa.parse(csv,{header:true}).data[0]
 assert.ok(parsed.order_id.startsWith("' ="));assert.equal(parsed.actual_shipping_cost_cents,'')
 for(const s of ['=1','+1','-1','@a',' \t=1','\rhello','a,"b"\nline'])assert.equal(safeCsvCell(s),s==='a,"b"\nline'?s:"'"+s)
 assert.equal(safeCsvCell(-10),-10)
 assert.equal(Papa.parse(Papa.unparse({fields:BOOKKEEPING_COLUMNS,data:[]}),{header:true}).meta.fields.length,BOOKKEEPING_COLUMNS.length)
 assert.equal(calcProfitStats([],costs).netProfit,0)
})
test('invalid receipts make affected product costs unknown instead of using a partial average',()=>{
 assert.deepEqual(calcWeightedAvgCostByProduct([{product_id:'1',quantity:2,total_cost_cents:200},{product_id:'1',quantity:0,total_cost_cents:200}]),{})
})
