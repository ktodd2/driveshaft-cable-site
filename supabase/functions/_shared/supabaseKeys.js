// No legacy fallback: missing migration configuration must fail closed.
// Owners may use named platform dictionaries or these nonreserved overrides.
export function readSupabaseKey(kind, env) {
  const secret = kind === 'secret'
  if (!secret && kind !== 'publishable') return undefined
  const override = env.get(secret ? 'STORE_SUPABASE_SECRET_KEY' : 'STORE_SUPABASE_PUBLISHABLE_KEY')
  let key = override
  if (!key) {
    try {
      const keys = JSON.parse(env.get(secret ? 'SUPABASE_SECRET_KEYS' : 'SUPABASE_PUBLISHABLE_KEYS') || '{}')
      key = keys?.[secret ? 'store_backend' : 'store_web']
    } catch { return undefined }
  }
  const prefix = secret ? 'sb_secret_' : 'sb_publishable_'
  return typeof key === 'string' && key.startsWith(prefix) && key.length > prefix.length ? key : undefined
}

export const getSupabaseSecretKey = () => readSupabaseKey('secret', Deno.env)
export const getSupabasePublishableKey = () => readSupabaseKey('publishable', Deno.env)

// API gateway compatibility is not authorization; compare the configured key.
export function hasBackendApiKey(req, key) {
  return Boolean(key && req.headers.get('apikey') === key)
}
