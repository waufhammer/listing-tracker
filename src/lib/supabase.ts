import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Server-only admin client (service key bypasses RLS)
export const supabaseAdmin = (() => {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) return null as unknown as ReturnType<typeof createClient>
  return createClient(supabaseUrl, secret)
})()
