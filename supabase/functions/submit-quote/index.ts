import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { createApiClient } from '../_shared/supabaseTransport.js'
import { getSupabaseSecretKey, getSupabasePublishableKey } from '../_shared/supabaseKeys.js'
import { createQuoteHandler } from '../_shared/quoteSubmission.js'
serve(createQuoteHandler({env:Deno.env,createDb:(url,key)=>createApiClient(createClient,url,key),secretKey:getSupabaseSecretKey,publishableKey:getSupabasePublishableKey}))
