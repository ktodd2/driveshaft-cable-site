import { loadEnv } from 'vite'
import { storefrontReady } from './storefront-readiness.mjs'

// Render supplies RENDER=true. Offline local builds need no production credential.
if (process.env.RENDER === 'true') {
  try {
    if (!await storefrontReady(loadEnv('production', process.cwd(), 'VITE_'))) throw new Error('not ready')
    console.log('[storefront] Publishable-key readiness passed')
  } catch {
    console.error('[storefront] Publishable-key readiness failed; verify private Render configuration')
    process.exitCode = 1
  }
}
