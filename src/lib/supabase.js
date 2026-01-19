import { createClient } from '@supabase/supabase-js'

// These will be replaced with your actual Supabase credentials
// Set these as environment variables in Render
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Function to submit quote request
export async function submitQuoteRequest(formData) {
  const { data, error } = await supabase
    .from('quote_requests')
    .insert([
      {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        quantity: formData.quantity,
        message: formData.message,
        created_at: new Date().toISOString()
      }
    ])
    .select()

  if (error) {
    console.error('Error submitting quote:', error)
    throw error
  }

  return data
}

/*
-- SUPABASE TABLE SETUP --
Run this SQL in your Supabase SQL Editor to create the quote_requests table:

CREATE TABLE quote_requests (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  quantity INTEGER,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'new'
);

-- Enable Row Level Security
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from anonymous users
CREATE POLICY "Allow anonymous inserts" ON quote_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create policy to allow reading for authenticated users (admin)
CREATE POLICY "Allow authenticated reads" ON quote_requests
  FOR SELECT
  TO authenticated
  USING (true);
*/
