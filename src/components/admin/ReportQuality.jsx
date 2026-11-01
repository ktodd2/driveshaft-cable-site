import React from 'react'
import { formatPrice } from '../../stores/cartStore'
import { REPORT_LIMITATIONS } from '../../lib/profitReporting'
export default function ReportQuality({ stats, excluded = 0 }) {
  return <div className="border border-yellow-500/40 bg-yellow-500/10 p-4 mb-6 text-sm text-yellow-200" role="note">
    <p className="font-bold">Reporting basis: recorded paid orders · UTC calendar dates</p>
    <p>{stats.ordersWithShippingEstimates} included orders use the owner-specified $15 shipping fallback ({formatPrice(stats.totalShippingEstimateCents)} estimated in total); their actual shipping costs remain unentered.</p>
    {stats.ordersWithoutShipping > stats.ordersWithShippingEstimates && <p>{stats.ordersWithoutShipping - stats.ordersWithShippingEstimates} orders have invalid shipping costs that cannot use the missing-cost fallback.</p>}
    <p>{stats.ordersWithoutProductCost} orders lack product costs; {stats.ordersWithOtherUnknowns} have unknown or invalid totals, taxes or fees.</p>
    {stats.incompleteOrders > 0 ? <p className="mt-2">{stats.incompleteOrders} orders still have incomplete estimates. Contribution, margin and affected cost totals remain withheld until those other inputs are available.</p> : <p className="mt-2">All included orders have calculable estimates. Contribution includes the shipping fallback and is not verified net profit.</p>}
    <p className="mt-2">{REPORT_LIMITATIONS}</p>
    <details className="mt-2"><summary className="cursor-pointer">Eligibility and dates · {excluded} records outside this report</summary>
      <p>Uses order-created dates, not payment settlement dates. Only recorded paid, confirmed/shipped/delivered orders are included. Cancelled, closed, refunded and other noneligible statuses are excluded, along with known test/refund markers where available. Payment status is not independent payment verification. Outside-report counts include date exclusions.</p>
    </details>
  </div>
}
