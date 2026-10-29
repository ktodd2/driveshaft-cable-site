import { getSupabaseSecretKey, getSupabasePublishableKey, hasBackendApiKey } from './supabaseKeys.js'
import { createApiClient } from './supabaseTransport.js'

// Same authority as AdminLoginPage: an active database-maintained admin row.
// Call only with a user ID obtained from auth.getUser(), never request metadata.
export async function isActiveAdmin(userClient, userId) {
  if (!userId) return false
  try {
    const { data, error } = await userClient.from('admin_users').select('id')
      .eq('id', userId).eq('is_active', true).maybeSingle()
    return !error && data?.id === userId
  } catch { return false }
}

export async function authorizeStoreRequest(req, createClient, { allowCron = false } = {}) {
  if (hasBackendApiKey(req, getSupabaseSecretKey())) return true
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const cronToken = allowCron ? Deno.env.get('CRON_TRIGGER_KEY') : undefined
  if (cronToken && token === cronToken) return true
  if (!token) return false
  try {
    const client = createApiClient(createClient, Deno.env.get('SUPABASE_URL'), getSupabasePublishableKey(), {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data, error } = await client.auth.getUser(token)
    return !error && !!data?.user && await isActiveAdmin(client, data.user.id)
  } catch { return false }
}
