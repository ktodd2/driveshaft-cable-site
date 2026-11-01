// Distinguish a rejected save from an uncertain transport outcome. Retry uncertain
// writes with the exact same request ID, revision and document.
export function storageError(error) {
  const code = error?.code
  const definitive = ['40001','42501','P0001','22P02','22007','22008','23505','23514','PGRST202','42883'].includes(code)
  const unavailable = ['PGRST202','42883'].includes(code)
  return Object.assign(new Error(unavailable ? 'Shared storage is not installed. Browser drafts are available only on this device.' : code==='40001' ? 'Another device changed the plan. Fetch and review the latest shared version before saving.' : code==='42501' ? 'Active admin access is required for shared plans.' : definitive ? error.message : 'Save outcome is uncertain. Retry the same save before making another shared change.'), { definitive, unavailable })
}
export async function readSharedPlan(client) {
  const { data, error } = await client.rpc('get_inventory_plan')
  if (error) throw storageError(error)
  if (!Number.isInteger(data?.revision) || !Array.isArray(data?.document?.lines)) throw Error('Invalid shared plan response. Editor unchanged.')
  return data
}
export async function writeSharedPlan(client, request) {
  let result
  try { result = await client.rpc('save_inventory_plan', request) } catch { throw storageError(null) }
  if (result.error) throw storageError(result.error)
  if (!['saved','already_saved'].includes(result.data?.status) || !Number.isInteger(result.data?.revision) || !Number.isInteger(result.data?.current_revision)) throw storageError(null)
  return result.data
}
