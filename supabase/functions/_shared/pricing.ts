// Server-side mirror of pricing constants from src/stores/cartStore.js.
//
// The `products` table in the database is the source of truth at runtime —
// admin price edits via /admin/products take effect for tax calculations
// immediately. The hardcoded PRODUCT_PRICING constant below is a fallback
// used when the DB query fails (network blip, RLS misconfig, etc.) so a
// transient infra problem never blocks checkout.
//
// Sales are also applied here: when a customer is mid-checkout and a
// time-limited sale is active, calculate-tax pulls the sale, applies the
// % off on top of the tier/base price, and Stripe Tax is computed against
// the discounted line totals.

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

// ---- Per-invocation cache (one cron / tax-calc call = one cache) -----------

type CachedProduct = { base_price_cents: number; tiers: { min: number; price: number }[] }

interface Sale {
  id: string
  discount_percent: number
  scope: 'sitewide' | 'product'
  product_id: string | null
  starts_at: string
  ends_at: string
  is_active: boolean
}

// One cache per Edge Function invocation. Holds both per-product pricing rows
// and the active-sales array so each piece of data is fetched at most once
// across an arbitrary number of line items in the same request.
export interface DbCache {
  products: Map<string, CachedProduct | null>
  sales: Sale[] | null   // null = not yet loaded; [] = loaded, none active
}

export function makeDbCache(): DbCache {
  return { products: new Map(), sales: null }
}

function pickTierPrice(p: CachedProduct, qty: number): number {
  const sorted = [...p.tiers].sort((a, b) => b.min - a.min)
  for (const t of sorted) {
    if (qty >= t.min) return t.price
  }
  return p.base_price_cents
}

async function loadProduct(
  productId: string,
  client: SupabaseClient,
  cache?: DbCache,
): Promise<CachedProduct | null> {
  if (cache?.products.has(productId)) return cache.products.get(productId) ?? null
  const { data, error } = await client
    .from('products')
    .select('base_price_cents, tiers')
    .eq('id', productId)
    .maybeSingle()
  let row: CachedProduct | null = null
  if (error) {
    console.warn('pricing.loadProduct: query failed, falling back', error)
  } else if (data) {
    row = {
      base_price_cents: data.base_price_cents,
      tiers: Array.isArray(data.tiers) ? data.tiers : [],
    }
  }
  cache?.products.set(productId, row)
  return row
}

async function loadActiveSales(
  client: SupabaseClient,
  cache?: DbCache,
): Promise<Sale[]> {
  if (cache && cache.sales !== null) return cache.sales
  const nowIso = new Date().toISOString()
  const { data, error } = await client
    .from('sales')
    .select('id, discount_percent, scope, product_id, starts_at, ends_at, is_active')
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
  let rows: Sale[] = []
  if (error) {
    console.warn('pricing.loadActiveSales: query failed, treating as no sales', error)
  } else if (Array.isArray(data)) {
    rows = data as Sale[]
  }
  if (cache) cache.sales = rows
  return rows
}

// Pick the best (highest %) sale applicable to a product. Product-scoped wins
// ties over sitewide so a product can be discounted deeper than the rest.
function bestSaleFor(productId: string, sales: Sale[]): Sale | null {
  const candidates = sales.filter(s =>
    s.scope === 'sitewide' || s.product_id === productId
  )
  if (!candidates.length) return null
  candidates.sort((a, b) =>
    b.discount_percent - a.discount_percent ||
    (b.scope === 'product' ? 1 : -1)
  )
  return candidates[0]
}

export async function getPriceForQuantityFromDb(
  productId: string,
  qty: number,
  client: SupabaseClient,
  cache?: DbCache,
): Promise<number> {
  const row = await loadProduct(productId, client, cache)
  const tierPrice = row ? pickTierPrice(row, qty) : getPriceForQuantity(productId, qty)

  const sales = await loadActiveSales(client, cache)
  const sale = bestSaleFor(productId, sales)
  if (!sale) return tierPrice
  return Math.round((tierPrice * (100 - sale.discount_percent)) / 100)
}

// Convenience for callers that have a Supabase URL + service key but no
// pre-built client.
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}
