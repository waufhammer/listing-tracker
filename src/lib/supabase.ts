import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

// Client for use in browser (read-only public data)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Client for use in server-side code only (admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
