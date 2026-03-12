import React from 'react'

function InventoryProgressBar({ stock, totalStock, loading }) {
  if (loading || stock === null || totalStock === null || totalStock === 0) {
    return null
  }

  const sold = totalStock - stock
  const availablePercent = Math.max(0, Math.min(100, (stock / totalStock) * 100))

  // Color based on availability percentage
  const getBarColor = () => {
    if (availablePercent > 60) return 'bg-green-500'
    if (availablePercent > 30) return 'bg-yellow-500'
    if (availablePercent > 10) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getTextColor = () => {
    if (availablePercent > 60) return 'text-green-400'
    if (availablePercent > 30) return 'text-yellow-400'
    if (availablePercent > 10) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-gray-400">
          Available: <span className={`font-bold ${getTextColor()}`}>{stock}</span>
        </span>
        <span className="text-gray-400">
          Sold: <span className="text-white font-bold">{sold}</span>
        </span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${availablePercent}%` }}
        />
      </div>
    </div>
  )
}

export default InventoryProgressBar
