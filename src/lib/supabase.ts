import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// Client for use in browser (read-only public data)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Server-only admin client — imported separately to avoid bundling secret key into client code
export const supabaseAdmin = (() => {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) return null as unknown as ReturnType<typeof createClient>
  return createClient(supabaseUrl, secret)
})()
