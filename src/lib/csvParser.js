import Papa from 'papaparse'

/**
 * Parse a Pirate Ship CSV file and match rows to existing orders.
 * @param {File} file - The uploaded CSV file
 * @param {Array} orders - Array of order objects from Supabase
 * @returns {Promise<{matched, unmatched, errors}>}
 */
export function parsePirateShipCSV(file, orders) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const matched = []
        const unmatched = []
        const errors = []

        // Build lookup maps
        const orderByTracking = new Map()
        const orderByNameEmail = new Map()
        orders.forEach(order => {
          if (order.tracking_number) {
            orderByTracking.set(order.tracking_number.trim().toUpperCase(), order)
          }
          const key = `${(order.name || '').trim().toLowerCase()}|${(order.email || '').trim().toLowerCase()}`
          if (!orderByNameEmail.has(key)) {
            orderByNameEmail.set(key, order)
          }
        })

        const matchedOrderIds = new Set()

        results.data.forEach((row, index) => {
          try {
            // Detect shipping cost column (Pirate Ship uses various names)
            const costRaw = row['Total'] || row['Cost'] || row['Postage'] || row['Ship Cost'] || row['Amount'] || row['Label Cost'] || row['Shipping Cost']
            if (!costRaw) {
              unmatched.push({ row: index + 2, data: row, reason: 'No cost column found' })
              return
            }

            // Parse cost: remove $, convert to cents
            const costFloat = parseFloat(String(costRaw).replace(/[$,]/g, ''))
            if (isNaN(costFloat)) {
              errors.push({ row: index + 2, error: `Invalid cost value: ${costRaw}` })
              return
            }
            const shippingCostCents = Math.round(costFloat * 100)

            // Get tracking number from CSV
            const csvTracking = (row['Tracking Number'] || row['Tracking'] || row['Tracking #'] || '').trim().toUpperCase()

            // Strategy 1: Match by tracking number
            if (csvTracking && orderByTracking.has(csvTracking)) {
              const order = orderByTracking.get(csvTracking)
              if (!matchedOrderIds.has(order.id)) {
                matchedOrderIds.add(order.id)
                matched.push({
                  orderId: order.id,
                  orderName: order.name,
                  orderEmail: order.email,
                  shippingCostCents,
                  trackingNumber: csvTracking,
                  matchMethod: 'tracking'
                })
                return
              }
            }

            // Strategy 2: Match by name + email
            const csvName = (row['Full Name'] || row['Name'] || row['Recipient'] || row['Ship To Name'] || '').trim().toLowerCase()
            const csvEmail = (row['Email'] || row['E-mail'] || row['Buyer Email'] || '').trim().toLowerCase()
            if (csvName) {
              const key = `${csvName}|${csvEmail}`
              if (orderByNameEmail.has(key)) {
                const order = orderByNameEmail.get(key)
                if (!matchedOrderIds.has(order.id)) {
                  matchedOrderIds.add(order.id)
                  matched.push({
                    orderId: order.id,
                    orderName: order.name,
                    orderEmail: order.email,
                    shippingCostCents,
                    trackingNumber: csvTracking || null,
                    matchMethod: 'name+email'
                  })
                  return
                }
              }
            }

            unmatched.push({ row: index + 2, data: row, reason: 'No matching order found' })
          } catch (err) {
            errors.push({ row: index + 2, error: err.message })
          }
        })

        resolve({ matched, unmatched, errors })
      },
      error: (err) => reject(err)
    })
  })
}
