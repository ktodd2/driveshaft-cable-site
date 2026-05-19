// Validates a discount code at checkout.
//
// Two codes are currently valid: WELCOME5 (welcome series Day 0 email) and
// COMEBACK5 (abandoned cart recovery email). Both 5% off, single-use per
// email. Adding more codes = add one entry to VALID_CODES.
//
// This function does NOT write to discount_redemptions — that happens in
// stripe-webhook on payment_intent.succeeded, so an abandoned checkout
// doesn't burn a code prematurely.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// code -> percent off (0-100)
const VALID_CODES: Record<string, number> = {
  WELCOME5: 5,
  COMEBACK5: 5,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code: rawCode, email: rawEmail } = await req.json()

    const code = (rawCode || '').toString().trim().toUpperCase()
    const email = (rawEmail || '').toString().trim().toLowerCase()

    if (!code || !email) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'Code and email are required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const percentOff = VALID_CODES[code]
    if (!percentOff) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'Invalid discount code.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: existing, error } = await supabase
      .from('discount_redemptions')
      .select('id')
      .eq('code', code)
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.error('discount_redemptions lookup failed:', error)
      return new Response(
        JSON.stringify({ valid: false, reason: 'Could not verify code, please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (existing) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'This code has already been used.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ valid: true, code, percentOff }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, reason: error.message || 'Validation failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
