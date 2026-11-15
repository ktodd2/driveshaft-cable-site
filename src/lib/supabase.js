import { createApiClient } from '../../supabase/functions/_shared/supabaseTransport.js'
import { createClient } from '@supabase/supabase-js'

// These will be replaced with your actual Supabase credentials
// Set these as environment variables in Render
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'YOUR_SUPABASE_PUBLISHABLE_KEY'

export const supabase = createApiClient(createClient, supabaseUrl, supabasePublishableKey)

// All quote ingestion and notification happens server-side. Never insert directly.
export async function submitQuoteRequest(formData) {
  const { data, error } = await supabase.functions.invoke('submit-quote', { body: formData })
  if (error || !data?.success) throw error || new Error('Quote submission failed')
  return data
}
