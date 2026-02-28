import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'

/**
 * Parse a Pirate Ship file (CSV or XLSX) and match rows to existing orders.
 * @param {File} file - The uploaded file (.csv or .xlsx)
 * @param {Array} orders - Array of order objects from Supabase
 * @returns {Promise<{matched, unmatched, errors}>}
 */
export function parsePirateShipFile(file, orders) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(file, orders)
  }
  return parseCsv(file, orders)
}

// Keep old name as alias for backwards compatibility
export const parsePirateShipCSV = parsePirateShipFile

function parseCsv(file, orders) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(matchRows(results.data, orders)),
      error: (err) => reject(err)
    })
  })
}

async function parseXlsx(file, orders) {
  const rows = await readXlsxFile(file)
  if (!rows || rows.length < 2) {
    return { matched: [], unmatched: [], errors: ['File is empty or has no data rows'] }
  }
  // First row is headers, rest are data
  const headers = rows[0].map(h => String(h || '').trim())
  const data = rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] != null ? row[i] : '' })
    return obj
  })
  return matchRows(data, orders)
}

/**
 * Detect if data is a Pirate Ship transaction ledger (has Type + Description columns)
 * vs a generic shipment export (has Name/Tracking/Cost columns).
 */
function isPirateShipTransactionFormat(data) {
  if (!data || data.length === 0) return false
  const firstRow = data[0]
  return ('Type' in firstRow) && ('Description' in firstRow)
}

/**
 * Extract customer name from Pirate Ship Description field.
 * Format: "CustomerName: 1 Label Batch" or "CustomerName: N Label Batch"
 * Edge case: "Prompt Towing Attn: Mike: 1 Label Batch" — strip only the last ": N Label Batch"
 */
function extractNameFromDescription(description) {
  const desc = String(description || '').trim()
  // Strip the trailing ": N Label Batch" suffix
  const match = desc.match(/^(.+?):\s*\d+\s*Label\s*Batch\s*$/i)
  if (match) return match[1].trim()
  // Fallback: take everything before the first colon
  const colonIdx = desc.indexOf(':')
  if (colonIdx > 0) return desc.substring(0, colonIdx).trim()
  return desc
}

function matchRows(data, orders) {
  // Route to the correct parser based on detected format
  if (isPirateShipTransactionFormat(data)) {
    return matchPirateShipTransactions(data, orders)
  }
  return matchGenericRows(data, orders)
}

/**
 * Match Pirate Ship transaction ledger rows to orders.
 * Only processes "Label" type rows. Extracts name from Description, cost from Total.
 */
function matchPirateShipTransactions(data, orders) {
  const matched = []
  const unmatched = []
  const errors = []

  // Build name lookup: order.name.toLowerCase() → order
  const orderByName = new Map()
  orders.forEach(order => {
    const name = (order.name || '').trim().toLowerCase()
    if (name && !orderByName.has(name)) {
      orderByName.set(name, order)
    }
  })

  const matchedOrderIds = new Set()
  let skippedNonLabel = 0

  data.forEach((row, index) => {
    try {
      const rowType = String(row['Type'] || '').trim()

      // Only process Label rows (skip Payment, Refund, etc.)
      if (rowType !== 'Label') {
        skippedNonLabel++
        return
      }

      // Extract customer name from Description
      const description = String(row['Description'] || '')
      const csvName = extractNameFromDescription(description)
      if (!csvName) {
        unmatched.push({ row: index + 2, data: row, reason: 'Could not extract name from description' })
        return
      }

      // Get shipping cost from Total (negative for labels, take absolute value)
      const totalRaw = row['Total']
      const costFloat = parseFloat(String(totalRaw).replace(/[$,]/g, ''))
      if (isNaN(costFloat)) {
        errors.push({ row: index + 2, error: `Invalid cost value: ${totalRaw}` })
        return
      }
      const shippingCostCents = Math.round(Math.abs(costFloat) * 100)

      // Match by name
      const nameLower = csvName.toLowerCase()
      if (orderByName.has(nameLower)) {
        const order = orderByName.get(nameLower)
        if (!matchedOrderIds.has(order.id)) {
          matchedOrderIds.add(order.id)
          matched.push({
            orderId: order.id,
            orderName: order.name,
            orderEmail: order.email,
            shippingCostCents,
            trackingNumber: null,
            matchMethod: 'name'
          })
          return
        }
      }

      unmatched.push({ row: index + 2, data: row, reason: `No order found for "${csvName}"` })
    } catch (err) {
      errors.push({ row: index + 2, error: err.message })
    }
  })

  return { matched, unmatched, errors, skippedNonLabel }
}

/**
 * Match generic CSV/XLSX rows (columns like Name, Tracking Number, Cost, etc.)
 */
function matchGenericRows(data, orders) {
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

  data.forEach((row, index) => {
    try {
      // Detect shipping cost column
      const costRaw = row['Total'] || row['Cost'] || row['Postage'] || row['Ship Cost'] || row['Amount'] || row['Label Cost'] || row['Shipping Cost']
      if (!costRaw && costRaw !== 0) {
        unmatched.push({ row: index + 2, data: row, reason: 'No cost column found' })
        return
      }

      // Parse cost: remove $, convert to cents
      const costFloat = parseFloat(String(costRaw).replace(/[$,]/g, ''))
      if (isNaN(costFloat)) {
        errors.push({ row: index + 2, error: `Invalid cost value: ${costRaw}` })
        return
      }
      const shippingCostCents = Math.round(Math.abs(costFloat) * 100)

      // Get tracking number
      const csvTracking = String(row['Tracking Number'] || row['Tracking'] || row['Tracking #'] || '').trim().toUpperCase()

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
      const csvName = String(row['Full Name'] || row['Name'] || row['Recipient'] || row['Ship To Name'] || '').trim().toLowerCase()
      const csvEmail = String(row['Email'] || row['E-mail'] || row['Buyer Email'] || '').trim().toLowerCase()
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

  return { matched, unmatched, errors }
}
