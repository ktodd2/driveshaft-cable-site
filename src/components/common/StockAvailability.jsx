import React from 'react'

export default function StockAvailability({ stock, loading, unitLabel = 'units' }) {
  const known = stock != null && Number.isFinite(stock)
  const label = stock === 1 ? ({ units: 'unit', packs: 'pack' }[unitLabel] || unitLabel) : unitLabel
  const message = loading ? 'Checking stock…' : !known ? 'Stock unavailable' : stock <= 0 ? 'Out of stock' : `${stock.toLocaleString('en-US')} ${label} in stock`
  const color = loading || !known ? 'text-gray-400' : stock <= 0 ? 'text-red-400' : stock <= 20 ? 'text-yellow-400' : 'text-green-400'
  return <p role="status" className={`text-sm min-h-[1.5rem] ${color}`}>{message}</p>
}
