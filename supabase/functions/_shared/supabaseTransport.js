// Supabase SDK versions may copy the API key into Authorization. Modern API
// keys belong only in apikey; real user JWTs and dedicated tokens are retained.
export function modernKeyFetch(key, fetcher = globalThis.fetch) {
  return (input, init = {}) => {
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined))
    if (typeof key === 'string' && /^(sb_publishable_|sb_secret_)/.test(key) &&
        headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
    return fetcher(input, { ...init, headers })
  }
}

export function createApiClient(createClient, url, key, options = {}) {
  if (!key) throw new Error('Supabase API key is not configured')
  return createClient(url, key, {
    ...options,
    global: { ...options.global, fetch: modernKeyFetch(key, options.global?.fetch) },
  })
}
