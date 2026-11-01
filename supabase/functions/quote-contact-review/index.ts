import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isActiveAdmin } from '../_shared/storeAuthorization.js'
import { createApiClient } from '../_shared/supabaseTransport.js'
import { getSupabaseSecretKey, getSupabasePublishableKey } from '../_shared/supabaseKeys.js'
import { readReviewSources } from '../_shared/quoteReview.js'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Admin access required' }, 401)
    const userClient = createApiClient(createClient, Deno.env.get('SUPABASE_URL'), getSupabasePublishableKey(), { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data, error } = await userClient.auth.getUser(token)
    if (error || !data?.user || !await isActiveAdmin(userClient, data.user.id)) return json({ error: 'Admin access required' }, 401)
    const client = createApiClient(createClient, Deno.env.get('SUPABASE_URL'), getSupabaseSecretKey())
    return json({ sources: await readReviewSources(client), checkedAt: new Date().toISOString() })
  } catch { return json({ error: 'Review unavailable' }, 503) }
})
