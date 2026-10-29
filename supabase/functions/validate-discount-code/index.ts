import { createApiClient } from '../_shared/supabaseTransport.js'
import { getSupabaseSecretKey } from '../_shared/supabaseKeys.js'
// Validates a discount code at checkout.
//
// Valid codes live in _shared/discounts.ts (DISCOUNT_CODES), which
// create-payment-intent also uses to re-check the code before charging.
//
// This function does NOT write to discount_redemptions — that happens in
// stripe-webhook on payment_intent.succeeded, so an abandoned checkout
// doesn't burn a code prematurely.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkDiscountCode } from '../_shared/discounts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, email } = await req.json()

    const supabase = createApiClient(createClient,
      Deno.env.get('SUPABASE_URL')!,
      getSupabaseSecretKey()!
    )

    const result = await checkDiscountCode(code, email, supabase)
    const body = result.valid
      ? { valid: true, code: result.code, percentOff: result.percentOff }
      : { valid: false, reason: result.reason }

    return new Response(
      JSON.stringify(body),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: !result.valid && result.lookupFailed ? 500 : 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, reason: error.message || 'Validation failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
