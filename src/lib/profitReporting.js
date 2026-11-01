import { isRecordedPaidOrder } from './needsAttention.js'
import { calcOrderProfit, DEFAULT_SHIPPING_ESTIMATE_CENTS } from './costCalculations.js'
export { isRecordedPaidOrder }
export const REPORT_LIMITATIONS = 'Estimates, not net profit: current per-product weighted costs are not historical COGS. Stripe fees assume 2.9% + $0.30 (unknown method assumes Stripe); cash/Zelle/CashApp assume no fees. Tax is excluded. Refunds and operating expenses are unreconciled; test-mode and refund history are not fully available. Missing shipping uses an owner-specified $15 reporting estimate, not a verified carrier charge. Other unknown costs remain unknown.'
// UTC calendar dates, inclusive start, exclusive end; today plus prior N-1 days.
export function filterReportOrders(orders, range='30d', start='', end='', now=new Date()) {
  let from = -Infinity, to = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)
  const days = {'7d':7,'30d':30,'90d':90,year:365}[range]
  if(days) from=to-days*86400000
  if(range==='custom') {
    from=start?Date.parse(start+'T00:00:00Z'):-Infinity
    to=end?Date.parse(end+'T00:00:00Z')+86400000:to
  }
  return orders.filter(o=>isRecordedPaidOrder(o)&&Date.parse(o.created_at)>=from&&Date.parse(o.created_at)<to)
}
export function bookkeepingRows(orders,costs,fallback=DEFAULT_SHIPPING_ESTIMATE_CENTS) {
  return orders.map(o=>{
    const r=calcOrderProfit(o,costs,fallback)
    return {order_id:o.id,created_at_utc:o.created_at,currency:'USD',payment_status:o.payment_status,order_status:o.status,payment_method:o.payment_method??'unknown',
      subtotal_cents:o.subtotal_cents??null,discount_cents:o.discount_cents??null,shipping_charged_cents:o.shipping_cents??null,tax_cents:o.tax_cents??null,order_total_cents:o.total_cents??null,
      revenue_excluding_tax_cents:r.revenue,units:r.units,product_cost_estimate_cents:r.productCost,actual_shipping_cost_cents:o.actual_shipping_cost_cents??null,
      shipping_estimate_cents:r.shippingEstimated?r.shippingCost:null,shipping_estimate_source:r.shippingEstimated?'owner_specified_reporting_fallback_not_carrier_verified':'',processing_fee_estimate_cents:r.stripeFee,contribution_estimate_cents:r.profit,
      shipping_cost_status:r.shippingKnown?'recorded':r.shippingEstimated?'estimated':'unknown',product_cost_status:r.productKnown?'current_weighted_average':'unknown',
      refund_status:'unreconciled',payment_verification:'recorded_status_only',test_mode_status:'unverified',uncertainty_flags:r.uncertaintyFlags.join(';'),data_quality:r.profit===null?'incomplete':'estimate_only',limitations:REPORT_LIMITATIONS}
  })
}
export const BOOKKEEPING_COLUMNS = Object.keys(bookkeepingRows([{items:[]}],{})[0])
export function safeCsvCell(value) {
  return typeof value==='string' && (/^[\s\u0000-\u001f]*[=+@-]/.test(value)||/^[\t\r\n]/.test(value)) ? "'"+value : value
}
