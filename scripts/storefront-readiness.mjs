const PROJECT_URL = 'https://twrihhyfvomqiqbxkitc.supabase.co'

export async function storefrontReady(env, request = fetch) {
  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (url !== PROJECT_URL || typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return false
  try {
    const response = await request(`${PROJECT_URL}/rest/v1/products?select=id&limit=0`, {
      headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(10000),
    })
    await response.body?.cancel()
    return response.status === 200
  } catch { return false }
}
