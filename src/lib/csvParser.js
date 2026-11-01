import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import { reviewShippingRows } from './shippingImport.js'

export function validateShippingGrid(rows) {
  if (!rows || rows.length < 2) throw new Error('File is empty or has no data rows.')
  if (rows.length > 10001) throw new Error('Use a file with no more than 10,000 rows.')
  const headers = rows[0].map(h => String(h ?? '').trim())
  if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('Headers must be nonempty and unique.')
  return rows.slice(1).filter(row => row.some(v => v != null && String(v).trim() !== '')).map((row, i) => {
    if (row.length > headers.length) throw new Error(`Row ${i + 2} has more cells than the header.`)
    return Object.fromEntries(headers.map((h, j) => [h, row[j] ?? '']))
  })
}
export async function parsePirateShipFile(file, orders) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Use a file smaller than 10 MB.')
  const ext = file.name.split('.').pop().toLowerCase()
  let grid
  if (ext === 'xlsx') grid = await readXlsxFile(file)
  else if (ext === 'csv') {
    const parsed = Papa.parse(await file.text(), { skipEmptyLines: 'greedy' })
    if (parsed.errors.length) throw new Error(`Malformed CSV: ${parsed.errors[0].message}`)
    grid = parsed.data
  } else throw new Error('Choose a CSV or XLSX file. Save legacy XLS files as XLSX first.')
  return reviewShippingRows(validateShippingGrid(grid), orders)
}
export const parsePirateShipCSV = parsePirateShipFile
