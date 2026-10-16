// Server-side discount rules. Mirrors the math in src/pages/CheckoutPage.jsx
// so the server-computed total matches what the customer was shown — keep
// the rounding expressions identical to the client's.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// code -> percent off (0-100). Both single-use per email.
//   WELCOME5  — welcome series Day 0 email
//   COMEBACK5 — abandoned cart recovery email
export const DISCOUNT_CODES: Record<string, number> = {
  WELCOME5: 5,
  COMEBACK5: 5,
}

// Must match REPEAT_CUSTOMER_DISCOUNT in src/stores/cartStore.js.
export const REPEAT_CUSTOMER_DISCOUNT = 0.10

export type CodeCheck =
  | { valid: true; code: string; percentOff: number }
  | { valid: false; reason: string; lookupFailed?: boolean }

export async function checkDiscountCode(
  rawCode: unknown,
  rawEmail: unknown,
  client: SupabaseClient,
): Promise<CodeCheck> {
  const code = (rawCode || '').toString().trim().toUpperCase()
  const email = (rawEmail || '').toString().trim().toLowerCase()
  if (!code || !email) return { valid: false, reason: 'Code and email are required.' }

  const percentOff = DISCOUNT_CODES[code]
  if (!percentOff) return { valid: false, reason: 'Invalid discount code.' }

  const { data: existing, error } = await client
    .from('discount_redemptions')
    .select('id')
    .eq('code', code)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    console.error('discount_redemptions lookup failed:', error)
    return { valid: false, reason: 'Could not verify code, please try again.', lookupFailed: true }
  }
  if (existing) return { valid: false, reason: 'This code has already been used.' }

  return { valid: true, code, percentOff }
}

export async function isRepeatCustomer(email: string, client: SupabaseClient): Promise<boolean> {
  const { count, error } = await client
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('email', email.toLowerCase().trim())
    .eq('payment_status', 'paid')
  if (error) {
    console.warn('isRepeatCustomer: lookup failed, treating as new customer', error)
    return false
  }
  return (count ?? 0) > 0
}
