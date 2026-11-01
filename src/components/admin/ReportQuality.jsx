import React from 'react'
import { REPORT_LIMITATIONS } from '../../lib/profitReporting'
export default function ReportQuality({ stats, excluded = 0 }) {
  return <div className="border border-yellow-500/40 bg-yellow-500/10 p-4 mb-6 text-sm text-yellow-200" role="note">
    <p className="font-bold">Reporting basis: recorded paid orders · UTC calendar dates</p>
    <p>{stats.ordersWithoutShipping} included orders lack recorded shipping costs; {stats.ordersWithoutProductCost} lack product costs. {stats.incompleteOrders} have incomplete contribution estimates. {stats.ordersWithOtherUnknowns} have unknown or invalid totals, taxes or fees.</p>
    <p className="mt-2">Incomplete contribution and margin are withheld. Cost totals require complete costs or explicit estimates. Shipping estimate 0 means unknown.</p>
    <p className="mt-2">{REPORT_LIMITATIONS}</p>
    <details className="mt-2"><summary className="cursor-pointer">Eligibility and dates · {excluded} records outside this report</summary>
      <p>Uses order-created dates, not payment settlement dates. Only recorded paid, confirmed/shipped/delivered orders are included. Cancelled, closed, refunded and other noneligible statuses are excluded, along with known test/refund markers where available. Payment status is not independent payment verification. Outside-report counts include date exclusions.</p>
    </details>
  </div>
}
