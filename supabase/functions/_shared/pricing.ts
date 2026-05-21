// Server-side mirror of pricing constants from src/stores/cartStore.js.
//
// The `products` table in the database is the source of truth at runtime —
// admin price edits via /admin/products take effect for tax calculations
// immediately. The hardcoded PRODUCT_PRICING constant below is a fallback
// used when the DB query fails (network blip, RLS misconfig, etc.) so a
// transient infra problem never blocks checkout.
//
// If you add a new product via admin, this file does NOT need editing —
// getPriceForQuantityFromDb() will resolve it dynamically.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const MIN_ORDER_QUANTITY = 10
export const SHIPPING_FEE = 1500 // $15.00 in cents
export const FREE_SHIPPING_THRESHOLD = 40000 // $400.00 in cents

interface ProductPricing {
  name: string
  basePrice: number
  tiers: ReadonlyArray<{ min: number; price: number }>
}

// Hardcoded fallback — must match cartStore.js PRODUCT_PRICING.
export const PRODUCT_PRICING: Record<string, ProductPricing> = {
  '1': {
    name: 'Driveshaft Cable',
    basePrice: 345,
    tiers: [
      { min: 200, price: 290 },
      { min: 100, price: 315 },
      { min: 50,  price: 335 },
    ],
  },
  '2': {
    name: 'Driveshaft Cable +',
    basePrice: 395,
    tiers: [
      { min: 200, price: 340 },
      { min: 100, price: 365 },
      { min: 50,  price: 385 },
    ],
  },
}

// Back-compat aliases.
export const PRICE_PER_UNIT = PRODUCT_PRICING['1'].basePrice
export const PRICING_TIERS = PRODUCT_PRICING['1'].tiers

// Synchronous price resolution against the hardcoded fallback. Use this only
// when DB access isn't available; production callers should prefer the async
// `getPriceForQuantityFromDb` so admin edits flow through.
export function getPriceForQuantity(productId: string, qty: number): number {
  const pricing = PRODUCT_PRICING[productId] || PRODUCT_PRICING['1']
  for (const tier of pricing.tiers) {
    if (qty >= tier.min) return tier.price
  }
  return pricing.basePrice
}

export function computeShipping(subtotalCents: number): number {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}

// Small in-function cache so a single request handling N line items doesn't
// hit the products table N times. Lifetime is one Edge Function invocation.
type CachedProduct = { base_price_cents: number; tiers: { min: number; price: number }[] }
type DbCache = Map<string, CachedProduct | null>

function pickTierPrice(p: CachedProduct, qty: number): number {
  const sorted = [...p.tiers].sort((a, b) => b.min - a.min)
  for (const t of sorted) {
    if (qty >= t.min) return t.price
  }
  return p.base_price_cents
}

export function makeDbCache(): DbCache {
  return new Map()
}

export async function getPriceForQuantityFromDb(
  productId: string,
  qty: number,
  client: SupabaseClient,
  cache?: DbCache,
): Promise<number> {
  let row: CachedProduct | null
  if (cache?.has(productId)) {
    row = cache.get(productId) ?? null
  } else {
    const { data, error } = await client
      .from('products')
      .select('base_price_cents, tiers')
      .eq('id', productId)
      .maybeSingle()
    if (error) {
      console.warn('pricing.getPriceForQuantityFromDb: query failed, falling back', error)
      row = null
    } else {
      row = data
        ? {
            base_price_cents: data.base_price_cents,
            tiers: Array.isArray(data.tiers) ? data.tiers : [],
          }
        : null
    }
    cache?.set(productId, row)
  }
  if (!row) return getPriceForQuantity(productId, qty)
  return pickTierPrice(row, qty)
}

// Convenience for callers that have a Supabase URL + service key but no
// pre-built client.
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}
