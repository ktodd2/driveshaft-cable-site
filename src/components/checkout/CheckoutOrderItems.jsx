import React from 'react'
import { formatPrice, getPriceForQuantity } from '../../stores/cartStore'
import { isBoltPack, packQuantity, priceUnit } from '../../lib/productPresentation'

export default function CheckoutOrderItems({ items, pricesLocked = false }) {
  return (
    <div className="space-y-4 mb-6">
      {items.map(item => {
        // Draft carts store the original base price. Use the same live tier/sale
        // calculation as the subtotal until the server locks a payable checkout.
        // Payment and resumed-checkout snapshots already contain priced units.
        const unitCents = pricesLocked ? item.price : getPriceForQuantity(item.productId, item.quantity)
        return (
          <div key={item.productId} data-testid={`checkout-item-${item.productId}`} className="flex gap-4">
            <div className="w-16 h-16 bg-gray-700 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 50 40" className="w-10 h-8">
                <path d="M 8 20 Q 25 10 42 20" stroke="#9CA3AF" strokeWidth="2" fill="none" />
                <rect x="3" y="16" width="9" height="8" rx="1" fill="#D4A017" />
                <rect x="38" y="16" width="9" height="8" rx="1" fill="#D4A017" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 break-words">
              <div className="text-white text-sm">{item.name}</div>
              <div className="text-gray-400 text-xs">Qty: {isBoltPack(item) ? packQuantity(item, item.quantity) : item.quantity}</div>
              <div data-testid="checkout-unit-price" className="text-gray-400 text-xs">{formatPrice(unitCents)}/{priceUnit(item)}</div>
            </div>
            <div data-testid="checkout-line-total" className="text-white text-sm whitespace-nowrap">
              {formatPrice(unitCents * item.quantity)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
